import { NextResponse } from 'next/server';
import * as path from 'node:path';
import { createDocument, ensureUserCompanyContext, listCompaniesForUser, listDocumentsForCompany } from '../../../../lib/server/firestoreService';
import { uploadDocumentToFirebase, isFirebaseStorageConfigured, writeLocalFallback } from '../../../../lib/server/firebaseStorage';
import { enqueueDocumentAiProcessing } from '../../../../lib/server/documentAi';
import { analyzeDocumentWithAI, extractExpiryDateWithAI } from '../../../../lib/server/pdfExtractor';
import { summarizeDocumentForKnowledgeBase } from '../../../../lib/server/documentSummary';
import { publishRescoreEvent } from '../../../../lib/server/analystEngine';
import { requireAuth } from '../../../../lib/server/apiAuth';
import { rateLimit, RateLimits } from '../../../../lib/server/rateLimiter';
import { validateFileType, sanitizeFilename, getMimeTypeForExtension } from '../../../../lib/server/mimeValidation';
import { logFileUpload, logSuspiciousActivity } from '../../../../lib/server/securityAudit';
import { calculateSha256 } from '../../../../lib/server/documentIntegrity';
import { DOCUMENT_UPLOAD_CATEGORIES, type DocumentUploadCategory } from '../../../../lib/api/types';

// Document upload runs AI extraction, expiry detection and summarisation against
// Claude, which can exceed the default serverless timeout. Allow the full Netlify
// Pro execution budget so the upload completes instead of the function being
// killed mid-request (a bare 500).
export const maxDuration = 26;

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.txt', '.csv', '.zip',
]);
const ALLOWED_CATEGORIES = new Set<string>(DOCUMENT_UPLOAD_CATEGORIES);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / 1024 / 1024;

export async function POST(req: Request) {
  // Rate limiting for file uploads
  const rateLimitError = await rateLimit(req, RateLimits.upload);
  if (rateLimitError) return rateLimitError;

  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    let activeCompanyId = user!.activeCompanyId;
    if (!activeCompanyId) {
      const companies = await listCompaniesForUser(user!.id);
      activeCompanyId = companies[0]?.id;
    }

    if (!activeCompanyId) {
      const ensured = await ensureUserCompanyContext(user!.id);
      activeCompanyId = ensured?.id ?? null;
    }

    if (!activeCompanyId) {
      return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formError) {
      console.warn('Document upload form parsing failed:', formError);
      return NextResponse.json(
        { detail: `File upload is too large or malformed. Maximum file size is ${MAX_FILE_SIZE_MB} MB.` },
        { status: 413 },
      );
    }
    const file = formData.get('file');
    const category = String(formData.get('category') || '').trim();
    const runAi = String(formData.get('run_ai') ?? 'true').toLowerCase() !== 'false';

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ detail: 'File upload is required' }, { status: 400 });
    }
    const uploadedFile = file as File;

    const filename = String(uploadedFile.name || 'document.bin');
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      await logFileUpload(req, user!.id, activeCompanyId, filename, false, `Disallowed extension: ${ext}`);
      return NextResponse.json(
        { detail: `File type '${ext}' is not allowed.` },
        { status: 400 },
      );
    }

    const documentCategory = ALLOWED_CATEGORIES.has(category)
      ? (category as DocumentUploadCategory)
      : 'tax_clearance';

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const fileSize = buffer.length;
    const fileHash = calculateSha256(buffer);

    if (fileSize > MAX_FILE_SIZE) {
      await logFileUpload(req, user!.id, activeCompanyId, filename, false, `File size exceeded: ${fileSize} bytes`);
      return NextResponse.json(
        { detail: `File size (${(fileSize / 1024 / 1024).toFixed(1)} MB) exceeds the ${MAX_FILE_SIZE_MB} MB limit.` },
        { status: 413 },
      );
    }

    // Validate file type using magic bytes (not just extension)
    const mimeType = getMimeTypeForExtension(ext) || 'application/octet-stream';
    const mimeValidation = validateFileType(buffer, ext, mimeType);
    
    if (!mimeValidation.valid) {
      await logSuspiciousActivity(req, user!.id, 'File type spoofing attempt', {
        filename,
        declaredExtension: ext,
        declaredMimeType: mimeType,
        detectedType: mimeValidation.detectedType,
        reason: mimeValidation.reason,
      });
      await logFileUpload(req, user!.id, activeCompanyId, filename, false, mimeValidation.reason);
      return NextResponse.json(
        { detail: mimeValidation.reason || 'Invalid file type' },
        { status: 400 },
      );
    }

    const safeFileName = sanitizeFilename(filename);
    const storageKey = `company_${activeCompanyId}/${Date.now()}_${safeFileName}`;

    // Extract PDF content if applicable
    let extractedText: string | undefined;
    let pageCount: number | undefined;
    let documentAnalysis: NonNullable<Parameters<typeof createDocument>[0]['documentAnalysis']> | undefined;
    let extractionStatus: 'ok' | 'failed' | 'skipped' = 'skipped';
    let extractionError: string | null = null;
    let aiSummary: string | undefined;
    let aiSummaryModel: string | undefined;
    let detectedExpiryDate: string | null = null;

    // Mime types we can feed to the model inline for direct (multimodal) reading.
    const EXT_INLINE_MIME: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    const inlineMime = EXT_INLINE_MIME[ext];
    const isAiReadable = Boolean(inlineMime);

    if (isAiReadable && runAi) {
      try {
        const {
          extractPDFContent,
          transcribeDocumentWithAI,
        } = await import('../../../../lib/server/pdfExtractor');

        let extractor = 'claude-vision';

        // 1. Digital PDFs: pull the text layer first (fast, free, exact).
        if (ext === '.pdf') {
          const pdfResult = await extractPDFContent(buffer);
          extractedText = pdfResult.text;
          pageCount = pdfResult.pageCount;
          extractor = pdfResult.extractor;
        }

        // 2. OCR fallback via Claude for scanned PDFs (no/weak text layer) and
        //    image uploads — recovers text that parsing cannot.
        if (!extractedText || extractedText.trim().length < 200) {
          const ocrText = await transcribeDocumentWithAI(buffer, inlineMime);
          if (ocrText.trim().length > (extractedText?.trim().length ?? 0)) {
            extractedText = ocrText;
            extractor = ext === '.pdf' ? 'claude-ocr' : 'claude-vision';
            if (!pageCount) pageCount = 1;
          }
        }

        // 3. Analyze. Always pass the raw file so the model reads layout/scans
        //    directly (multimodal), with the extracted text as grounding.
        const analysis = await analyzeDocumentWithAI(
          extractedText ?? '',
          pageCount ?? 1,
          { buffer, mimeType: inlineMime },
        );

        const hasUsableResult = Boolean(extractedText?.trim()) || analysis.documentType !== null || analysis.confidence >= 0.2;

        if (hasUsableResult) {
          documentAnalysis = {
            wordCount: analysis.wordCount,
            hasSignature: analysis.hasSignature,
            hasDate: analysis.hasDate,
            hasCompanyName: analysis.hasCompanyName,
            hasRegistrationNumber: analysis.hasRegistrationNumber,
            hasVatNumber: analysis.hasVatNumber,
            hasBBBEELevel: analysis.hasBBBEELevel,
            detectedDates: analysis.detectedDates,
            detectedAmounts: analysis.detectedAmounts,
            documentType: analysis.documentType,
            confidence: analysis.confidence,
            keywords: analysis.keywords,
            csdSupplierSummary: analysis.csdSupplierSummary,
          };

          if (extractedText?.trim()) {
            // Detect expiry date using the configured AI provider, falling back to regex.
            detectedExpiryDate = await extractExpiryDateWithAI(extractedText);

            const summaryResult = await summarizeDocumentForKnowledgeBase(extractedText);
            aiSummary = summaryResult.summary ?? undefined;
            aiSummaryModel = summaryResult.model ?? undefined;
          }
          extractionStatus = 'ok';
        } else {
          extractionStatus = 'failed';
          extractionError = 'No readable content found. The file may be corrupt, encrypted, or blank.';
        }
        console.log(`Document read with ${extractor}: ${pageCount ?? 0} pages, ${extractedText?.length ?? 0} chars`);
      } catch (aiError) {
        console.warn('Document AI extraction warning:', aiError);
        extractionStatus = 'failed';
        extractionError = aiError instanceof Error ? aiError.message : 'Document extraction failed';
        // Continue without extraction - document will still be stored
      }
    } else if (isAiReadable && !runAi) {
      extractionStatus = 'skipped';
      extractionError = 'AI extraction was skipped by user choice.';
    }

    // Upload to storage
    let fileUrl: string;
    let persistedStoragePath: string;
    try {
      if (isFirebaseStorageConfigured()) {
        try {
          fileUrl = await uploadDocumentToFirebase(storageKey, buffer, mimeType);
          persistedStoragePath = storageKey;
          console.log(`Document uploaded to Firebase Storage: ${fileUrl}`);
        } catch (firebaseStorageError) {
          console.warn('Firebase storage upload failed, falling back to local storage.', firebaseStorageError);
          fileUrl = writeLocalFallback(storageKey, buffer);
          persistedStoragePath = fileUrl;
          console.log(`Document saved locally after Firebase fallback: ${fileUrl}`);
        }
      } else {
        fileUrl = writeLocalFallback(storageKey, buffer);
        persistedStoragePath = fileUrl;
        console.log(`Document saved locally: ${fileUrl}`);
      }
    } catch (storageError) {
      console.error('Storage save failed:', storageError);
      return NextResponse.json({ detail: 'Failed to save document to storage.' }, { status: 500 });
    }

    const existingDocuments = await listDocumentsForCompany(activeCompanyId);

    // Create document record with full metadata
    const document = await createDocument({
      companyId: activeCompanyId,
      name: safeFileName,
      category: documentCategory,
      fileUrl,
      storagePath: persistedStoragePath,
      expiryDate: detectedExpiryDate,
      fileSize,
      fileHash,
      mimeType,
      pageCount,
      extractedText: extractedText?.slice(0, 50000), // Limit stored text to 50KB
      extractionStatus,
      extractionError,
      aiSummary: aiSummary?.slice(0, 4000),
      aiSummaryModel,
      aiSummaryUpdatedAt: aiSummary ? new Date().toISOString() : undefined,
      documentAnalysis,
    });

    // Queue AI processing for further analysis
    enqueueDocumentAiProcessing(document.id, storageKey, activeCompanyId);

    await publishRescoreEvent({
      eventType: 'document.uploaded',
      companyId: activeCompanyId,
      actorUserId: user.id,
      metadata: {
        documentId: document.id,
        category: document.category,
        extractionStatus,
        fileHash,
        firstCompanyDocument: existingDocuments.length === 0,
        documentsUploaded: existingDocuments.length + 1,
      },
    });

    // Log successful upload for security audit
    await logFileUpload(req, user.id, activeCompanyId, safeFileName, true);

    return NextResponse.json({
      ...document,
      extraction: {
        status: extractionStatus,
        error: extractionError,
        extracted: Boolean(extractedText?.trim()),
        extractor: isAiReadable && runAi ? 'multi-engine' : null,
      },
      aiTriggered: runAi && isAiReadable,
      message: extractedText 
        ? `Document uploaded and analyzed (${pageCount} pages, ${documentAnalysis?.wordCount ?? 0} words)`
        : 'Document uploaded successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/documents/upload error:', error);
    return NextResponse.json({ detail: 'Failed to upload document' }, { status: 500 });
  }
}
