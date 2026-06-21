import { NextResponse } from 'next/server';
import * as path from 'node:path';
import {
  createDocument,
  ensureUserCompanyContext,
  listCompaniesForUser,
  listDocumentsForCompany,
} from '../../../../lib/server/firestoreService';
import {
  uploadDocumentToFirebase,
  isFirebaseStorageConfigured,
  writeLocalFallback,
} from '../../../../lib/server/firebaseStorage';
import { processBulkDocument } from '../../../../lib/server/bulkDocumentProcessor';
import { enqueueDocumentAiProcessing } from '../../../../lib/server/documentAi';
import { publishRescoreEvent } from '../../../../lib/server/analystEngine';
import { requireAuth } from '../../../../lib/server/apiAuth';
import { rateLimit, RateLimits } from '../../../../lib/server/rateLimiter';
import { validateFileType, sanitizeFilename } from '../../../../lib/server/mimeValidation';
import { logFileUpload, logSuspiciousActivity } from '../../../../lib/server/securityAudit';
import { calculateSha256 } from '../../../../lib/server/documentIntegrity';
import { docCategoryLabel } from '../../../../lib/utils/formatters';

// A bundle can be larger than a single document, so allow a higher ceiling.
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
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
      console.warn('Bulk upload form parsing failed:', formError);
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

    if (ext !== '.pdf') {
      await logFileUpload(req, user!.id, activeCompanyId, filename, false, `Bulk upload requires PDF, got: ${ext}`);
      return NextResponse.json({ detail: 'Bulk upload only supports PDF files.' }, { status: 400 });
    }

    const sourceBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const fileSize = sourceBuffer.length;

    if (fileSize > MAX_FILE_SIZE) {
      await logFileUpload(req, user!.id, activeCompanyId, filename, false, `File size exceeded: ${fileSize} bytes`);
      return NextResponse.json(
        { detail: `File size (${(fileSize / 1024 / 1024).toFixed(1)} MB) exceeds the ${MAX_FILE_SIZE_MB} MB limit.` },
        { status: 413 },
      );
    }

    // Validate the real file type via magic bytes, not just the extension.
    const mimeType = uploadedFile.type || 'application/pdf';
    const mimeValidation = validateFileType(sourceBuffer, ext, mimeType);
    if (!mimeValidation.valid) {
      await logSuspiciousActivity(req, user!.id, 'File type spoofing attempt (bulk upload)', {
        filename,
        declaredExtension: ext,
        declaredMimeType: mimeType,
        detectedType: mimeValidation.detectedType,
        reason: mimeValidation.reason,
      });
      await logFileUpload(req, user!.id, activeCompanyId, filename, false, mimeValidation.reason);
      return NextResponse.json({ detail: mimeValidation.reason || 'Invalid file type' }, { status: 400 });
    }

    // Read pages, classify each bundled document and split into per-document PDFs.
    let processed: Awaited<ReturnType<typeof processBulkDocument>>;
    try {
      processed = await processBulkDocument(sourceBuffer);
    } catch (processError) {
      console.error('Bulk document processing failed:', processError);
      return NextResponse.json(
        { detail: 'Could not read this PDF. It may be corrupted or password-protected.' },
        { status: 422 },
      );
    }

    if (processed.documents.length === 0) {
      return NextResponse.json(
        { detail: 'No documents could be identified in this PDF.' },
        { status: 422 },
      );
    }

    const baseName = sanitizeFilename(filename).replace(/\.pdf$/i, '');
    const existingDocuments = await listDocumentsForCompany(activeCompanyId);
    const saved: Array<{
      id: string;
      name: string;
      category: string;
      categoryLabel: string;
      pages: string;
      expiryDate: string | null;
      confidence: number;
      classifiedBy: string;
    }> = [];

    for (const { segment, buffer } of processed.documents) {
      const segmentName = sanitizeFilename(`${baseName}-${segment.category}.pdf`);
      const storageKey = `company_${activeCompanyId}/${Date.now()}_${segmentName}`;
      const fileHash = calculateSha256(buffer);

      let fileUrl: string;
      let persistedStoragePath: string;
      try {
        if (isFirebaseStorageConfigured()) {
          try {
            fileUrl = await uploadDocumentToFirebase(storageKey, buffer, 'application/pdf');
            persistedStoragePath = storageKey;
          } catch (firebaseStorageError) {
            console.warn('Firebase storage upload failed (bulk), falling back to local:', firebaseStorageError);
            fileUrl = writeLocalFallback(storageKey, buffer);
            persistedStoragePath = fileUrl;
          }
        } else {
          fileUrl = writeLocalFallback(storageKey, buffer);
          persistedStoragePath = fileUrl;
        }
      } catch (storageError) {
        console.error('Storage save failed for split document, skipping:', storageError);
        continue;
      }

      const pageLabel = segment.startPage === segment.endPage
        ? `p.${segment.startPage}`
        : `p.${segment.startPage}-${segment.endPage}`;

      const document = await createDocument({
        companyId: activeCompanyId,
        name: segmentName,
        category: segment.category,
        fileUrl,
        storagePath: persistedStoragePath,
        expiryDate: segment.expiryDate,
        fileSize: buffer.length,
        fileHash,
        mimeType: 'application/pdf',
        pageCount: segment.endPage - segment.startPage + 1,
        extractionStatus: 'ok',
        extractionError: null,
        aiSummary: `Auto-extracted from bundle "${filename}" (${pageLabel}, ${segment.classifiedBy} classification).`,
      });

      // Enrich the split file in the background with full per-document analysis
      // (extracted text, keywords, summary). Preserves the expiry we detected.
      enqueueDocumentAiProcessing(document.id, persistedStoragePath, activeCompanyId);

      saved.push({
        id: document.id,
        name: segmentName,
        category: segment.category,
        categoryLabel: docCategoryLabel(segment.category),
        pages: pageLabel,
        expiryDate: segment.expiryDate,
        confidence: segment.confidence,
        classifiedBy: segment.classifiedBy,
      });
    }

    if (saved.length === 0) {
      return NextResponse.json(
        { detail: 'Documents were identified but could not be saved to storage.' },
        { status: 500 },
      );
    }

    await publishRescoreEvent({
      eventType: 'document.uploaded',
      companyId: activeCompanyId,
      actorUserId: user!.id,
      metadata: {
        bulkUpload: true,
        sourceFile: filename,
        documentsCreated: saved.length,
        categories: saved.map((s) => s.category),
        firstCompanyDocument: existingDocuments.length === 0,
        documentsUploaded: existingDocuments.length + saved.length,
      },
    });

    await logFileUpload(req, user!.id, activeCompanyId, `${filename} (bulk → ${saved.length} docs)`, true);

    return NextResponse.json(
      {
        message: `Identified and filed ${saved.length} document${saved.length === 1 ? '' : 's'} from ${processed.pageCount} pages.`,
        pageCount: processed.pageCount,
        classificationMethod: processed.method,
        documents: saved,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/documents/bulk-upload error:', error);
    return NextResponse.json({ detail: 'Failed to process bulk upload' }, { status: 500 });
  }
}
