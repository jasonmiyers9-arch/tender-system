import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDocumentById, updateDocument } from './firestoreService';
import { downloadDocumentFromFirebase, isFirebaseStorageConfigured } from './firebaseStorage';
import { analyzeDocumentContent, extractExpiryDate, extractPDFContent } from './pdfExtractor';
import { summarizeDocumentForKnowledgeBase } from './documentSummary';

async function loadDocumentBuffer(storageRef: string): Promise<Buffer> {
  // Firebase storage references are blob names like "company_x/file.pdf".
  if (isFirebaseStorageConfigured() && !path.isAbsolute(storageRef)) {
    const { buffer } = await downloadDocumentFromFirebase(storageRef);
    return buffer;
  }

  const absolutePath = path.isAbsolute(storageRef)
    ? storageRef
    : path.join(process.cwd(), storageRef.replace(/^\/+/, ''));
  return fs.readFile(absolutePath);
}

function isPdfDocument(name: string, mimeType?: string): boolean {
  if (mimeType?.toLowerCase().includes('pdf')) return true;
  return name.toLowerCase().endsWith('.pdf');
}

export async function reExtractDocumentAi(documentId: string, requestedBy?: string): Promise<{ ok: boolean; extractionStatus: 'ok' | 'failed' | 'skipped'; error?: string | null }> {
  const doc = await getDocumentById(documentId);
  if (!doc) {
    return { ok: false, extractionStatus: 'failed', error: 'Document not found' };
  }

  if (!isPdfDocument(doc.name, doc.mimeType)) {
    await updateDocument(documentId, {
      extractionStatus: 'skipped',
      extractionError: 'Only PDF files are supported for extraction.',
    });
    return { ok: true, extractionStatus: 'skipped', error: 'Only PDF files are supported for extraction.' };
  }

  const storageRef = doc.storagePath ?? doc.fileUrl ?? '';
  if (!storageRef) {
    await updateDocument(documentId, {
      extractionStatus: 'failed',
      extractionError: 'No storage reference found for this document.',
    });
    return { ok: false, extractionStatus: 'failed', error: 'No storage reference found for this document.' };
  }

  try {
    const buffer = await loadDocumentBuffer(storageRef);
    const extracted = await extractPDFContent(buffer);
    const text = extracted.text?.trim() ?? '';

    if (!text) {
      await updateDocument(documentId, {
        pageCount: extracted.pageCount,
        extractedText: '',
        extractionStatus: 'failed',
        extractionError: 'No extractable text found in PDF.',
      });
      return { ok: false, extractionStatus: 'failed', error: 'No extractable text found in PDF.' };
    }

    const analysis = analyzeDocumentContent(text, extracted.pageCount);
    const summary = await summarizeDocumentForKnowledgeBase(text);
    const detectedExpiry = extractExpiryDate(text);

    await updateDocument(documentId, {
      pageCount: extracted.pageCount,
      extractedText: text.slice(0, 50000),
      extractionStatus: 'ok',
      extractionError: null,
      expiryDate: doc.expiryDate ?? detectedExpiry,
      aiSummary: summary.summary?.slice(0, 4000),
      aiSummaryModel: summary.model ?? undefined,
      aiSummaryUpdatedAt: summary.summary ? new Date().toISOString() : undefined,
      documentAnalysis: {
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
      },
    });

    console.info('Document AI extraction complete.', {
      documentId,
      requestedBy: requestedBy ?? 'system',
      chars: text.length,
      pages: extracted.pageCount,
      model: summary.model ?? 'local-fallback',
    });

    return { ok: true, extractionStatus: 'ok', error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Document extraction failed';
    await updateDocument(documentId, {
      extractionStatus: 'failed',
      extractionError: message,
    });
    console.warn('Document AI extraction failed.', { documentId, requestedBy: requestedBy ?? 'system', error: message });
    return { ok: false, extractionStatus: 'failed', error: message };
  }
}

export function enqueueDocumentAiProcessing(documentId: string, storageKey: string, companyId: string): void {
  const enabled = process.env.DOCUMENT_AI_ENABLED === 'true' || process.env.DOCUMENT_AI_ENABLED === '1';
  if (!enabled) {
    console.info('Document AI pipeline disabled; skipping analysis.', { documentId, companyId, storageKey });
    return;
  }

  console.info('Document AI pipeline scheduled for document.', {
    documentId,
    companyId,
    storageKey,
  });

  // Fire-and-forget background pass so uploads return quickly.
  setTimeout(() => {
    void reExtractDocumentAi(documentId).catch((error) => {
      console.warn('Background document AI processing failed.', { documentId, error });
    });
  }, 0);
}
