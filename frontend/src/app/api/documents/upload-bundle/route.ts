import { NextResponse } from 'next/server';
import * as path from 'node:path';
import { createDocument, ensureUserCompanyContext, listCompaniesForUser, listDocumentsForCompany } from '../../../../lib/server/firestoreService';
import { uploadDocumentToFirebase, isFirebaseStorageConfigured, writeLocalFallback } from '../../../../lib/server/firebaseStorage';
import { enqueueDocumentAiProcessing } from '../../../../lib/server/documentAi';
import { analyzeComplianceBundle, type DetectedBundleDocument } from '../../../../lib/server/bundleAnalyzer';
import { publishRescoreEvent } from '../../../../lib/server/analystEngine';
import { requireAuth } from '../../../../lib/server/apiAuth';
import { rateLimit, RateLimits } from '../../../../lib/server/rateLimiter';
import { validateFileType, sanitizeFilename } from '../../../../lib/server/mimeValidation';
import { logFileUpload, logSuspiciousActivity } from '../../../../lib/server/securityAudit';
import { calculateSha256 } from '../../../../lib/server/documentIntegrity';

// The bundle splitter sends the uploaded file to Claude for multimodal reading,
// which can take far longer than the default serverless timeout. Allow the full
// Netlify Pro execution budget so the analysis completes instead of the function
// being killed mid-request (which surfaces in the browser as a bare 500).
export const maxDuration = 26;

// The bundle splitter relies on multimodal vision, so only formats the model can
// read are accepted here (PDF + common image types). Other office formats should
// use the standard single-document upload route.
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / 1024 / 1024;

export async function POST(req: Request) {
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
      console.warn('Bundle upload form parsing failed:', formError);
      return NextResponse.json(
        { detail: `File upload is too large or malformed. Maximum file size is ${MAX_FILE_SIZE_MB} MB.` },
        { status: 413 },
      );
    }

    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ detail: 'File upload is required' }, { status: 400 });
    }
    const uploadedFile = file as File;

    const filename = String(uploadedFile.name || 'bundle.pdf');
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      await logFileUpload(req, user!.id, activeCompanyId, filename, false, `Disallowed bundle extension: ${ext}`);
      return NextResponse.json(
        { detail: `File type '${ext}' is not supported for smart bundle upload. Use a PDF or image (PNG, JPG).` },
        { status: 400 },
      );
    }

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

    const declaredMime = uploadedFile.type || 'application/octet-stream';
    const mimeValidation = validateFileType(buffer, ext, declaredMime);
    if (!mimeValidation.valid) {
      await logSuspiciousActivity(req, user!.id, 'File type spoofing attempt (bundle)', {
        filename,
        declaredExtension: ext,
        declaredMimeType: declaredMime,
        detectedType: mimeValidation.detectedType,
        reason: mimeValidation.reason,
      });
      await logFileUpload(req, user!.id, activeCompanyId, filename, false, mimeValidation.reason);
      return NextResponse.json({ detail: mimeValidation.reason || 'Invalid file type' }, { status: 400 });
    }

    const EXT_TO_MIME: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };
    const mimeType = EXT_TO_MIME[ext] ?? 'application/pdf';

    const safeFileName = sanitizeFilename(filename);
    const storageKey = `company_${activeCompanyId}/${Date.now()}_${safeFileName}`;

    // Run the AI bundle analysis before persisting so we can report failures cleanly.
    const analysis = await analyzeComplianceBundle(buffer, mimeType);

    // Store the original bundle file once; every detected document references it.
    let fileUrl: string;
    let persistedStoragePath: string;
    try {
      if (isFirebaseStorageConfigured()) {
        try {
          fileUrl = await uploadDocumentToFirebase(storageKey, buffer, mimeType);
          persistedStoragePath = storageKey;
        } catch (firebaseStorageError) {
          console.warn('Firebase storage upload failed (bundle), using local fallback.', firebaseStorageError);
          fileUrl = writeLocalFallback(storageKey, buffer);
          persistedStoragePath = fileUrl;
        }
      } else {
        fileUrl = writeLocalFallback(storageKey, buffer);
        persistedStoragePath = fileUrl;
      }
    } catch (storageError) {
      console.error('Bundle storage save failed:', storageError);
      return NextResponse.json({ detail: 'Failed to save document to storage.' }, { status: 500 });
    }

    const existingDocuments = await listDocumentsForCompany(activeCompanyId);

    // If analysis succeeded with detected documents use them, otherwise fall back to
    // a single uncategorised document so the upload is never lost.
    const detected: DetectedBundleDocument[] = analysis.ok && analysis.documents.length > 0
      ? analysis.documents
      : [{
          category: 'other_compliance',
          title: safeFileName,
          expiryDate: null,
          issuingAuthority: null,
          summary: null,
          pages: null,
          confidence: 0,
        }];

    const aiModel = analysis.ok ? analysis.model : undefined;
    const aiSucceeded = analysis.ok && analysis.documents.length > 0;
    const nowIso = new Date().toISOString();

    const createdDocuments = [];
    for (const item of detected) {
      const summaryParts = [
        item.summary,
        item.issuingAuthority ? `Issuing authority: ${item.issuingAuthority}.` : null,
        item.pages ? `Source pages: ${item.pages}.` : null,
        `Filed automatically from bundled upload "${safeFileName}".`,
      ].filter(Boolean);

      const document = await createDocument({
        companyId: activeCompanyId,
        name: item.title || safeFileName,
        category: item.category,
        fileUrl,
        storagePath: persistedStoragePath,
        expiryDate: item.expiryDate,
        fileSize,
        fileHash,
        mimeType,
        extractionStatus: aiSucceeded ? 'ok' : 'skipped',
        extractionError: aiSucceeded
          ? null
          : (analysis.ok ? null : `Bundle AI analysis unavailable (${analysis.reason}). Filed as a single document.`),
        aiSummary: aiSucceeded ? summaryParts.join(' ').slice(0, 4000) : undefined,
        aiSummaryModel: aiModel,
        aiSummaryUpdatedAt: aiSucceeded ? nowIso : undefined,
      });

      enqueueDocumentAiProcessing(document.id, storageKey, activeCompanyId);
      createdDocuments.push({
        id: document.id,
        name: document.name,
        category: document.category,
        expiryDate: document.expiryDate,
        confidence: item.confidence,
        pages: item.pages,
      });
    }

    await publishRescoreEvent({
      eventType: 'document.uploaded',
      companyId: activeCompanyId,
      actorUserId: user!.id,
      metadata: {
        source: 'bundle',
        fileHash,
        documentsDetected: createdDocuments.length,
        firstCompanyDocument: existingDocuments.length === 0,
        documentsUploaded: existingDocuments.length + createdDocuments.length,
      },
    });

    await logFileUpload(req, user!.id, activeCompanyId, safeFileName, true);

    return NextResponse.json({
      documents: createdDocuments,
      detected: createdDocuments.length,
      aiAnalyzed: aiSucceeded,
      model: aiModel ?? null,
      message: aiSucceeded
        ? `Identified and filed ${createdDocuments.length} document${createdDocuments.length === 1 ? '' : 's'} from the bundle.`
        : 'AI analysis was unavailable. The file was saved as a single document for manual sorting.',
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/documents/upload-bundle error:', error);
    return NextResponse.json({ detail: 'Failed to process document bundle' }, { status: 500 });
  }
}
