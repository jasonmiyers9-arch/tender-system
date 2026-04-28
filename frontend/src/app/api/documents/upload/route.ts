import { NextResponse } from 'next/server';
import * as path from 'node:path';
import { createDocument, ensureUserCompanyContext, listCompaniesForUser } from '../../../../lib/server/firestoreService';
import { uploadDocumentToFirebase, isFirebaseStorageConfigured, writeLocalFallback } from '../../../../lib/server/firebaseStorage';
import { enqueueDocumentAiProcessing } from '../../../../lib/server/documentAi';
import { extractPDFContent, analyzeDocumentWithAI, extractExpiryDateWithAI } from '../../../../lib/server/pdfExtractor';
import { summarizeDocumentForKnowledgeBase } from '../../../../lib/server/documentSummary';
import { publishRescoreEvent } from '../../../../lib/server/analystEngine';
import { requireAuth } from '../../../../lib/server/apiAuth';
import { rateLimit, RateLimits } from '../../../../lib/server/rateLimiter';
import { validateFileType, sanitizeFilename } from '../../../../lib/server/mimeValidation';
import { logFileUpload, logSuspiciousActivity } from '../../../../lib/server/securityAudit';

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.txt', '.csv', '.zip',
]);
const ALLOWED_CATEGORIES = new Set(['tax', 'legal', 'financial', 'certification', 'bbbee', 'registration', 'policy'] as const);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

type DocumentCategory = 'tax' | 'legal' | 'financial' | 'certification' | 'bbbee' | 'registration' | 'policy';

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

    const formData = await req.formData();
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

    const documentCategory = ALLOWED_CATEGORIES.has(category as DocumentCategory)
      ? (category as DocumentCategory)
      : 'tax';

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const fileSize = buffer.length;

    if (fileSize > MAX_FILE_SIZE) {
      await logFileUpload(req, user!.id, activeCompanyId, filename, false, `File size exceeded: ${fileSize} bytes`);
      return NextResponse.json(
        { detail: `File size (${(fileSize / 1024 / 1024).toFixed(1)} MB) exceeds the 50 MB limit.` },
        { status: 413 },
      );
    }

    // Validate file type using magic bytes (not just extension)
    const mimeType = uploadedFile.type || 'application/octet-stream';
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

    if (ext === '.pdf' && runAi) {
      try {
        // Lazy-load PDF extraction to keep parsing dependencies out of build-time module evaluation.
        const { extractPDFContent, analyzeDocumentContent, extractExpiryDate } = await import('../../../../lib/server/pdfExtractor');
        const pdfResult = await extractPDFContent(buffer);
        extractedText = pdfResult.text;
        pageCount = pdfResult.pageCount;
        
        if (extractedText) {
          const analysis = await analyzeDocumentWithAI(extractedText, pageCount);
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
          };
          
          // Detect expiry date using Gemini (falls back to regex)
          detectedExpiryDate = await extractExpiryDateWithAI(extractedText);

          const summaryResult = await summarizeDocumentForKnowledgeBase(extractedText);
          aiSummary = summaryResult.summary ?? undefined;
          aiSummaryModel = summaryResult.model ?? undefined;
          extractionStatus = 'ok';
        } else {
          extractionStatus = 'failed';
          extractionError = 'No extractable text found. This PDF may be image-based or scanned and requires OCR before AI analysis.';
        }
        console.log(`PDF extracted with ${pdfResult.extractor}: ${pageCount} pages, ${extractedText?.length ?? 0} chars`);
      } catch (pdfError) {
        console.warn('PDF extraction warning:', pdfError);
        extractionStatus = 'failed';
        extractionError = pdfError instanceof Error ? pdfError.message : 'PDF extraction failed';
        // Continue without extraction - document will still be stored
      }
    } else if (ext === '.pdf' && !runAi) {
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

    // Create document record with full metadata
    const document = await createDocument({
      companyId: activeCompanyId,
      name: safeFileName,
      category: documentCategory,
      fileUrl,
      storagePath: persistedStoragePath,
      expiryDate: detectedExpiryDate,
      fileSize,
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
        extractor: ext === '.pdf' && runAi ? 'multi-engine' : null,
      },
      aiTriggered: runAi && ext === '.pdf',
      message: extractedText 
        ? `Document uploaded and analyzed (${pageCount} pages, ${documentAnalysis?.wordCount ?? 0} words)`
        : 'Document uploaded successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/documents/upload error:', error);
    return NextResponse.json({ detail: 'Failed to upload document' }, { status: 500 });
  }
}
