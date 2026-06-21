/**
 * Bulk Document Processor
 *
 * Takes a single PDF that contains several South African compliance documents
 * concatenated together (e.g. CIPC registration, SARS Tax Clearance and a
 * B-BBEE certificate in one file), figures out where each document starts and
 * ends, classifies each one into a specific Compliance Vault category, detects
 * its expiry date, and splits the source PDF into one standalone PDF per
 * detected document so each can be filed in its designated location.
 *
 * Classification runs the configured Gemini model first and falls back to a
 * deterministic keyword/regex pass when AI is unavailable, so the feature keeps
 * working without an API key (just with lower accuracy).
 */

import { PDFDocument } from 'pdf-lib';
import { chatWithOpenRouter, analyzeFileWithGemini } from './openRouterClient';
import {
  analyzeDocumentContent,
  extractExpiryDate,
  extractPDFPages,
  type PDFPageText,
} from './pdfExtractor';
import {
  DOCUMENT_UPLOAD_CATEGORIES,
  type DocumentUploadCategory,
} from '../api/types';

export interface DetectedDocumentSegment {
  category: DocumentUploadCategory;
  title: string;
  startPage: number; // 1-based, inclusive
  endPage: number; // 1-based, inclusive
  expiryDate: string | null;
  confidence: number; // 0..1
  classifiedBy: 'ai' | 'ai_vision' | 'heuristic';
}

export interface SplitDocument {
  segment: DetectedDocumentSegment;
  buffer: Buffer;
}

const ALLOWED_CATEGORY_SET = new Set<string>(DOCUMENT_UPLOAD_CATEGORIES);

/**
 * Short, human-readable descriptions of the categories the splitter can assign.
 * Kept deliberately small and SA-specific so the prompt stays focused on the
 * documents companies actually bundle together.
 */
const CATEGORY_GUIDE: Array<{ category: DocumentUploadCategory; hint: string }> = [
  { category: 'cipc_registration', hint: 'CIPC company registration / certificate of incorporation (CoR14.3, CK1/CK2)' },
  { category: 'tax_clearance', hint: 'SARS Tax Clearance Certificate / Tax Compliance Status (TCS) PIN letter' },
  { category: 'sars_pin', hint: 'SARS Tax Compliance Status PIN issued letter' },
  { category: 'vat_certificate', hint: 'SARS VAT registration certificate (VAT103/VAT101)' },
  { category: 'bbbee_certificate', hint: 'B-BBEE verification certificate issued by a SANAS-accredited agency' },
  { category: 'bbbee_affidavit', hint: 'B-BBEE sworn affidavit for EME / QSE' },
  { category: 'csd_supplier_summary', hint: 'Central Supplier Database (CSD) registration / supplier summary report' },
  { category: 'cidb_certificate', hint: 'CIDB contractor grading certificate' },
  { category: 'coida_certificate', hint: 'COIDA / Workmen\'s Compensation Letter of Good Standing' },
  { category: 'letter_good_standing', hint: 'Department of Labour Letter of Good Standing' },
  { category: 'company_profile', hint: 'Company profile / capability statement' },
  { category: 'director_ids', hint: 'Director or member identity documents' },
  { category: 'shareholder_register', hint: 'Shareholder register / share certificates' },
  { category: 'financial_statements', hint: 'Annual financial statements / management accounts' },
  { category: 'bank_statement', hint: 'Bank statement' },
  { category: 'bank_confirmation', hint: 'Bank account confirmation letter' },
  { category: 'public_liability_insurance', hint: 'Public liability insurance policy / schedule' },
  { category: 'professional_indemnity', hint: 'Professional indemnity insurance' },
  { category: 'iso_certificate', hint: 'ISO or other quality/management certification' },
  { category: 'proof_of_address', hint: 'Proof of business address / utility account' },
  { category: 'other_compliance', hint: 'Any other compliance document that does not fit the categories above' },
];

/**
 * Maps the broad documentType returned by the regex baseline analyzer to a
 * specific upload category, used by the heuristic fallback.
 */
const BROAD_TYPE_TO_CATEGORY: Record<string, DocumentUploadCategory> = {
  tax: 'tax_clearance',
  bbbee: 'bbbee_certificate',
  registration: 'cipc_registration',
  cidb: 'cidb_certificate',
  csd: 'csd_supplier_summary',
  financial: 'financial_statements',
  insurance: 'public_liability_insurance',
  certification: 'iso_certificate',
  legal: 'other_compliance',
};

function coerceCategory(value: unknown): DocumentUploadCategory | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (ALLOWED_CATEGORY_SET.has(normalized)) return normalized as DocumentUploadCategory;
  // Allow the model to answer with a broad type and map it.
  if (BROAD_TYPE_TO_CATEGORY[normalized]) return BROAD_TYPE_TO_CATEGORY[normalized];
  return null;
}

function coerceExpiry(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function clampPage(value: unknown, fallback: number, pageCount: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), 1), pageCount);
}

function buildClassificationPrompt(pages: PDFPageText[]): string {
  const categoryLines = CATEGORY_GUIDE.map((c) => `- ${c.category}: ${c.hint}`).join('\n');
  // Cap each page preview so a large bundle still fits the model context window.
  const perPageLimit = pages.length > 25 ? 350 : 700;
  const pageBlocks = pages
    .map((p) => `[PAGE ${p.page}]\n${(p.text || '(no extractable text on this page)').slice(0, perPageLimit)}`)
    .join('\n\n');

  return `You are processing a single PDF that bundles several South African compliance documents together.
Each page's extracted text is shown below, labelled [PAGE n].

Identify every distinct document in the bundle. A single document may span multiple consecutive pages.
For each document return its category, a short human title, the inclusive page range, and the expiry / validity-end date if one is stated.

Allowed categories (use the id exactly):
${categoryLines}

Rules:
- Page ranges must be contiguous, must not overlap, and together should cover the document pages in order.
- Use "other_compliance" only when nothing else fits.
- expiryDate must be "YYYY-MM-DD" or null. Do not guess; use null when no expiry is stated.
- confidence is a number between 0 and 1.

Return ONLY valid JSON, no markdown, in this exact shape:
{"documents":[{"category":"...","title":"...","startPage":1,"endPage":1,"expiryDate":null,"confidence":0.9}]}

Pages:
${pageBlocks}`;
}

/**
 * Deterministic fallback: classify every page on its own using the existing
 * keyword analyzer, then merge consecutive pages that share a category into one
 * segment.
 */
function heuristicSegments(pages: PDFPageText[]): DetectedDocumentSegment[] {
  const perPage = pages.map((p) => {
    const analysis = analyzeDocumentContent(p.text || '', 1);
    const broad = analysis.documentType;
    const category = (broad && BROAD_TYPE_TO_CATEGORY[broad]) || 'other_compliance';
    return {
      page: p.page,
      category,
      expiry: extractExpiryDate(p.text || ''),
      confidence: analysis.confidence,
    };
  });

  const segments: DetectedDocumentSegment[] = [];
  for (const entry of perPage) {
    const last = segments[segments.length - 1];
    if (last && last.category === entry.category) {
      last.endPage = entry.page;
      if (!last.expiryDate && entry.expiry) last.expiryDate = entry.expiry;
      last.confidence = Math.max(last.confidence, entry.confidence);
      continue;
    }
    segments.push({
      category: entry.category,
      title: titleForCategory(entry.category),
      startPage: entry.page,
      endPage: entry.page,
      expiryDate: entry.expiry,
      confidence: entry.confidence,
      classifiedBy: 'heuristic',
    });
  }
  return segments;
}

function titleForCategory(category: DocumentUploadCategory): string {
  const hint = CATEGORY_GUIDE.find((c) => c.category === category)?.hint;
  if (hint) return hint.split('/')[0].split('(')[0].trim();
  return category.replace(/_/g, ' ');
}

/**
 * Largest PDF we will send to the vision model inline. Gemini inline request
 * payloads must stay well under ~20 MB; base64 inflates bytes by ~33 %, so cap
 * the raw PDF at 14 MB to stay safely inside the request ceiling.
 */
const MAX_VISION_PDF_BYTES = 14 * 1024 * 1024;

/**
 * Classify the bundle into document segments. Tries AI first, falls back to the
 * deterministic heuristic when AI is unavailable or returns nothing usable.
 *
 * When the PDF has no extractable text layer (scanned / image-only), the model
 * cannot work from text previews, so the original PDF is sent to Gemini's vision
 * model which OCRs the page images and classifies them directly.
 */
export async function classifyBulkDocument(
  pages: PDFPageText[],
  sourceBuffer: Buffer,
): Promise<{
  segments: DetectedDocumentSegment[];
  method: 'ai' | 'ai_vision' | 'heuristic';
}> {
  const pageCount = pages.length;
  if (pageCount === 0) return { segments: [], method: 'heuristic' };

  const hasAnyText = pages.some((p) => p.text.trim().length > 0);
  if (!hasAnyText) {
    // No text layer (scanned/image PDF): OCR the page images with the vision model.
    const visionSegments = await classifyWithVision(sourceBuffer, pageCount);
    if (visionSegments && visionSegments.length > 0) {
      return { segments: visionSegments, method: 'ai_vision' };
    }

    // Vision unavailable or unusable — keep the file intact as one document so it
    // is still filed rather than discarded.
    return {
      segments: [
        {
          category: 'other_compliance',
          title: 'Scanned document (could not read text)',
          startPage: 1,
          endPage: pageCount,
          expiryDate: null,
          confidence: 0,
          classifiedBy: 'heuristic',
        },
      ],
      method: 'heuristic',
    };
  }

  const aiSegments = await classifyWithAi(pages, pageCount);
  if (aiSegments && aiSegments.length > 0) {
    return { segments: aiSegments, method: 'ai' };
  }

  return { segments: heuristicSegments(pages), method: 'heuristic' };
}

/**
 * OCR + classify a scanned/image-only PDF by sending the file itself to the
 * Gemini vision model. Returns null when the model is unavailable, the file is
 * too large to send inline, or the response cannot be parsed.
 */
async function classifyWithVision(
  sourceBuffer: Buffer,
  pageCount: number,
): Promise<DetectedDocumentSegment[] | null> {
  if (sourceBuffer.length > MAX_VISION_PDF_BYTES) {
    console.warn(
      `Bulk PDF too large for inline vision OCR (${sourceBuffer.length} bytes); skipping.`,
    );
    return null;
  }

  const categoryLines = CATEGORY_GUIDE.map((c) => `- ${c.category}: ${c.hint}`).join('\n');
  const prompt = `This PDF is a scanned bundle of several South African compliance documents with no digital text layer. Read the text directly from the page images (OCR).

The bundle has ${pageCount} page${pageCount === 1 ? '' : 's'}. Identify every distinct document. A single document may span multiple consecutive pages.
For each document return its category, a short human title, the inclusive 1-based page range, and the expiry / validity-end date if one is printed on it.

Allowed categories (use the id exactly):
${categoryLines}

Rules:
- Page ranges must be contiguous, must not overlap, and together should cover the document pages in order.
- Use "other_compliance" only when nothing else fits.
- expiryDate must be "YYYY-MM-DD" or null. Do not guess; use null when no expiry is stated.
- confidence is a number between 0 and 1.

Return ONLY valid JSON, no markdown, in this exact shape:
{"documents":[{"category":"...","title":"...","startPage":1,"endPage":1,"expiryDate":null,"confidence":0.9}]}`;

  const result = await analyzeFileWithGemini({
    data: sourceBuffer.toString('base64'),
    mimeType: 'application/pdf',
    prompt,
    systemInstruction:
      'You OCR and classify scanned South African compliance PDFs into individual documents. Return only valid JSON, no markdown.',
    temperature: 0,
    maxTokens: 1500,
  });

  if (!result.ok) return null;

  const segments = parseSegmentsFromAiJson(result.content, pageCount, 'ai_vision');
  return segments && segments.length > 0 ? segments : null;
}

async function classifyWithAi(
  pages: PDFPageText[],
  pageCount: number,
): Promise<DetectedDocumentSegment[] | null> {
  const result = await chatWithOpenRouter({
    temperature: 0,
    maxTokens: 1200,
    messages: [
      {
        role: 'system',
        content:
          'You split bundled South African compliance PDFs into individual documents and classify each. Return only valid JSON, no markdown.',
      },
      { role: 'user', content: buildClassificationPrompt(pages) },
    ],
  });

  if (!result.ok) return null;

  return parseSegmentsFromAiJson(result.content, pageCount, 'ai');
}

/**
 * Parse the model's JSON document list (from either text or vision
 * classification) into validated, page-sorted segments. Returns null when the
 * response cannot be parsed or yields no usable documents.
 */
function parseSegmentsFromAiJson(
  content: string,
  pageCount: number,
  classifiedBy: 'ai' | 'ai_vision',
): DetectedDocumentSegment[] | null {
  try {
    const raw = content
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
    const parsed = JSON.parse(raw) as { documents?: unknown };
    const docs = Array.isArray(parsed.documents) ? parsed.documents : [];

    const segments: DetectedDocumentSegment[] = [];
    for (const entry of docs) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const category = coerceCategory(e.category) ?? 'other_compliance';
      const startPage = clampPage(e.startPage, 1, pageCount);
      const endPage = clampPage(e.endPage, startPage, pageCount);
      if (endPage < startPage) continue;
      const confidenceRaw = typeof e.confidence === 'number' ? e.confidence : 0.5;
      segments.push({
        category,
        title: typeof e.title === 'string' && e.title.trim() ? e.title.trim().slice(0, 120) : titleForCategory(category),
        startPage,
        endPage,
        expiryDate: coerceExpiry(e.expiryDate),
        confidence: Math.min(Math.max(confidenceRaw, 0), 1),
        classifiedBy,
      });
    }

    if (segments.length === 0) return null;

    // Sort by start page so the split order matches the source document.
    segments.sort((a, b) => a.startPage - b.startPage);
    return segments;
  } catch (err) {
    console.warn('Bulk document AI classification parse failed:', err);
    return null;
  }
}

/**
 * Split the source PDF into one standalone PDF per detected segment using its
 * page range. Segments whose pages cannot be copied are skipped (logged), so a
 * single malformed range never fails the whole batch.
 */
export async function splitPdfBySegments(
  sourceBuffer: Buffer,
  segments: DetectedDocumentSegment[],
): Promise<SplitDocument[]> {
  if (segments.length === 0) return [];

  const source = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true });
  const totalPages = source.getPageCount();
  const output: SplitDocument[] = [];

  for (const segment of segments) {
    const start = Math.min(Math.max(segment.startPage, 1), totalPages);
    const end = Math.min(Math.max(segment.endPage, start), totalPages);
    const pageIndices: number[] = [];
    for (let i = start; i <= end; i += 1) pageIndices.push(i - 1); // pdf-lib is 0-based

    try {
      const target = await PDFDocument.create();
      const copied = await target.copyPages(source, pageIndices);
      copied.forEach((page) => target.addPage(page));
      const bytes = await target.save();
      output.push({ segment, buffer: Buffer.from(bytes) });
    } catch (err) {
      console.warn(`Failed to split segment ${segment.category} (pages ${start}-${end}):`, err);
    }
  }

  return output;
}

/**
 * Full pipeline: read pages, classify, split. Returns the split documents plus
 * metadata about how classification was performed.
 */
export async function processBulkDocument(sourceBuffer: Buffer): Promise<{
  pageCount: number;
  method: 'ai' | 'ai_vision' | 'heuristic';
  documents: SplitDocument[];
}> {
  // Read each page's text layer. Image-only/scanned PDFs yield empty text here,
  // and a malformed text layer can make extraction throw — neither should abort
  // the upload, since the vision OCR path can still read the page images.
  let pageCount = 0;
  let pages: PDFPageText[] = [];
  try {
    const extracted = await extractPDFPages(sourceBuffer);
    pageCount = extracted.pageCount;
    pages = extracted.pages;
  } catch (extractError) {
    console.warn('Per-page text extraction failed; falling back to vision OCR:', extractError);
  }

  // If text extraction produced no pages, recover the real page count (and the
  // per-page placeholders the vision classifier needs) directly from the PDF.
  if (pages.length === 0) {
    try {
      const doc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true });
      pageCount = doc.getPageCount();
      pages = Array.from({ length: pageCount }, (_, i) => ({ page: i + 1, text: '' }));
    } catch (loadError) {
      console.error('Could not load PDF to determine page count:', loadError);
      return { pageCount: 0, method: 'heuristic', documents: [] };
    }
  }

  const { segments, method } = await classifyBulkDocument(pages, sourceBuffer);
  const documents = await splitPdfBySegments(sourceBuffer, segments);
  return { pageCount, method, documents };
}
