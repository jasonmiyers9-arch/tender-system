/**
 * Compliance Bundle Analyzer
 *
 * Uses the configured Claude multimodal model to read a single uploaded file that
 * may bundle several compliance documents (e.g. a scan containing a CIPC
 * registration, a SARS Tax Clearance and a B-BBEE certificate) and split it into
 * individually categorised documents.
 *
 * Because the file is sent to the model as native multimodal input, this works for
 * both text-based PDFs and image-based / scanned PDFs as well as photographed
 * certificates (JPG / PNG) — no separate OCR step is required.
 */

import { chatWithOpenRouter } from './openRouterClient';
import { DOCUMENT_UPLOAD_CATEGORIES, type DocumentUploadCategory } from '../api/types';

export interface DetectedBundleDocument {
  category: DocumentUploadCategory;
  title: string;
  expiryDate: string | null;
  issuingAuthority: string | null;
  summary: string | null;
  pages: string | null;
  confidence: number;
}

export type BundleAnalysisResult =
  | { ok: true; documents: DetectedBundleDocument[]; model: string }
  | { ok: false; reason: 'no_api_key' | 'empty_response' | 'invalid_response' | 'exception'; error?: string };

const ALLOWED_CATEGORIES = new Set<string>(DOCUMENT_UPLOAD_CATEGORIES);

// File types the vision model can read directly.
export const BUNDLE_SUPPORTED_MIME_TYPES = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SYSTEM_INSTRUCTION = `You are a South African tender-compliance document analyst.
You are given a single file that may contain SEVERAL distinct compliance documents bundled together
(for example a CIPC registration certificate, a SARS Tax Clearance / Tax Compliance Status PIN, and a
B-BBEE certificate or affidavit). The file may be a scanned image or a photograph, so read it visually.

Identify EACH distinct document in the file. Do not merge different documents together and do not invent
documents that are not present. Return ONLY valid JSON (no markdown, no commentary) in this exact shape:
{
  "documents": [
    {
      "category": one of the allowed category ids below,
      "title": short human-readable document name,
      "expiryDate": "YYYY-MM-DD" or null if none is stated,
      "issuingAuthority": issuer name or null,
      "summary": one short factual sentence,
      "pages": page or page-range where the document appears (e.g. "1" or "2-3") or null,
      "confidence": number between 0 and 1
    }
  ]
}

Allowed category ids (choose the single best fit; use "other_compliance" only if nothing else fits):
${DOCUMENT_UPLOAD_CATEGORIES.join(', ')}

Category guidance:
- CIPC / COR / CK company registration -> cipc_registration
- SARS Tax Clearance Certificate or Tax Compliance Status PIN -> tax_clearance (or sars_pin if it is specifically a TCS PIN letter)
- VAT registration / VAT103 -> vat_certificate
- B-BBEE certificate from an accredited agency -> bbbee_certificate
- B-BBEE sworn affidavit (EME/QSE) -> bbbee_affidavit
- CSD / Central Supplier Database summary -> csd_supplier_summary
- CIDB grading -> cidb_certificate
- Letter of Good Standing (Compensation Fund) -> letter_good_standing
- Audited financials / annual financial statements -> financial_statements
- Bank statement -> bank_statement; bank confirmation letter -> bank_confirmation
Only output dates in ISO YYYY-MM-DD format. If a document has no expiry, use null.`;

function coerceDocuments(parsed: unknown): DetectedBundleDocument[] {
  const rawList =
    parsed && typeof parsed === 'object' && Array.isArray((parsed as { documents?: unknown }).documents)
      ? ((parsed as { documents: unknown[] }).documents)
      : Array.isArray(parsed)
        ? (parsed as unknown[])
        : [];

  const documents: DetectedBundleDocument[] = [];
  for (const entry of rawList) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;

    const rawCategory = String(record.category ?? '').trim();
    const category = (ALLOWED_CATEGORIES.has(rawCategory)
      ? rawCategory
      : 'other_compliance') as DocumentUploadCategory;

    const rawExpiry = typeof record.expiryDate === 'string' ? record.expiryDate.trim() : '';
    const expiryDate = ISO_DATE.test(rawExpiry) ? rawExpiry : null;

    const title = typeof record.title === 'string' && record.title.trim()
      ? record.title.trim().slice(0, 160)
      : null;

    const confidenceValue = Number(record.confidence);
    const confidence = Number.isFinite(confidenceValue)
      ? Math.min(Math.max(confidenceValue, 0), 1)
      : 0.5;

    documents.push({
      category,
      title: title ?? 'Compliance Document',
      expiryDate,
      issuingAuthority: typeof record.issuingAuthority === 'string' && record.issuingAuthority.trim()
        ? record.issuingAuthority.trim().slice(0, 160)
        : null,
      summary: typeof record.summary === 'string' && record.summary.trim()
        ? record.summary.trim().slice(0, 600)
        : null,
      pages: typeof record.pages === 'string' && record.pages.trim()
        ? record.pages.trim().slice(0, 40)
        : (typeof record.pages === 'number' ? String(record.pages) : null),
      confidence,
    });
  }

  return documents;
}

/**
 * Analyse a bundled compliance file and return the distinct documents it contains.
 */
export async function analyzeComplianceBundle(
  buffer: Buffer,
  mimeType: string,
): Promise<BundleAnalysisResult> {
  const effectiveMime = BUNDLE_SUPPORTED_MIME_TYPES.has(mimeType)
    ? (mimeType === 'image/jpg' ? 'image/jpeg' : mimeType)
    : 'application/pdf';

  const result = await chatWithOpenRouter({
    temperature: 0,
    maxTokens: 2048,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      {
        role: 'user',
        content:
          'Identify every distinct compliance document in the attached file and return ONLY the JSON described in your instructions.',
      },
    ],
    attachments: [{ mimeType: effectiveMime, data: buffer.toString('base64') }],
  });

  if (!result.ok) {
    if (result.reason === 'no_api_key') {
      return { ok: false, reason: 'no_api_key' };
    }
    return {
      ok: false,
      reason: 'exception',
      error: result.error ?? 'Bundle analysis request failed',
    };
  }

  const cleaned = result.content
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: 'invalid_response', error: 'Model did not return valid JSON' };
  }

  const documents = coerceDocuments(parsed);
  if (documents.length === 0) {
    return { ok: false, reason: 'invalid_response', error: 'No documents detected in bundle' };
  }

  return { ok: true, documents, model: result.model };
}
