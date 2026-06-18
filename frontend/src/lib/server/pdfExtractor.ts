/**
 * PDF Text Extraction Service
 * Extracts text content from PDF documents for compliance analysis and AI matching.
 * Follows government-class standards for document processing.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chatWithOpenRouter } from './openRouterClient';

type PdfJsModule = {
  getDocument: (src: { data: Uint8Array; disableWorker?: boolean; useWorkerFetch?: boolean; isEvalSupported?: boolean; useSystemFonts?: boolean }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{
          items: Array<{ str?: string }>;
        }>;
      }>;
      getMetadata: () => Promise<{
        info?: {
          Title?: string;
          Author?: string;
          Subject?: string;
          Creator?: string;
          Producer?: string;
          CreationDate?: string;
          ModDate?: string;
        };
        metadata?: unknown;
      }>;
      destroy?: () => Promise<void> | void;
    }>;
  };
};

type PdfParseResult = {
  text?: string;
  numpages?: number;
  info?: Record<string, unknown>;
  metadata?: unknown;
};

type PdfExtractEngine = 'pdfjs' | 'pdf-parse' | 'combined';

type CacheEnvelope = {
  cachedAt: number;
  result: PDFExtractResult;
};

const MAX_PAGES = 100;
const MEMORY_CACHE_TTL_MS = 1000 * 60 * 45;
const DISK_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const MEMORY_CACHE_MAX_ITEMS = 64;
const EXTRACTION_CACHE_DIR = path.join(process.cwd(), 'storage', '.pdf-extract-cache');
const extractionMemoryCache = new Map<string, CacheEnvelope>();

async function getPdfJs(): Promise<PdfJsModule> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfJsModule & {
    GlobalWorkerOptions?: { workerSrc?: string };
  };

  // Point pdfjs at the installed worker file to avoid Turbopack chunk resolution issues.
  if (pdfjs.GlobalWorkerOptions) {
    const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
    if (existsSync(workerPath)) {
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    }
  }

  return pdfjs;
}

export interface PDFExtractResult {
  text: string;
  pageCount: number;
  extractor: PdfExtractEngine;
  extractedAt: string;
  info: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  metadata: Record<string, unknown>;
}

export interface DocumentAnalysis {
  extractedText: string;
  pageCount: number;
  wordCount: number;
  characterCount: number;
  hasSignature: boolean;
  hasDate: boolean;
  hasCompanyName: boolean;
  hasRegistrationNumber: boolean;
  hasVatNumber: boolean;
  hasBBBEELevel: boolean;
  detectedDates: string[];
  detectedAmounts: string[];
  documentType: string | null;
  confidence: number;
  keywords: string[];
  csdSupplierSummary?: CsdSupplierSummaryAnalysis;
}

export interface CsdSupplierSummaryAnalysis {
  isCsdSupplierSummary: boolean;
  supplierNumber: string | null;
  legalName: string | null;
  tradingName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  vatNumber: string | null;
  bbbeeLevel: string | null;
  cidbGrade: string | null;
  province: string | null;
  municipality: string | null;
  bankAccountVerified: boolean | null;
  taxCompliant: boolean | null;
  active: boolean | null;
  fieldsComplete: number;
  fieldsTotal: number;
  completenessScore: number;
}

function cleanText(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function evictMemoryCacheIfNeeded(): void {
  while (extractionMemoryCache.size > MEMORY_CACHE_MAX_ITEMS) {
    const oldestKey = extractionMemoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    extractionMemoryCache.delete(oldestKey);
  }
}

function readFromMemoryCache(cacheKey: string): PDFExtractResult | null {
  const hit = extractionMemoryCache.get(cacheKey);
  if (!hit) return null;

  if (Date.now() - hit.cachedAt > MEMORY_CACHE_TTL_MS) {
    extractionMemoryCache.delete(cacheKey);
    return null;
  }

  // Refresh insertion order for simple LRU behavior.
  extractionMemoryCache.delete(cacheKey);
  extractionMemoryCache.set(cacheKey, hit);
  return hit.result;
}

function writeToMemoryCache(cacheKey: string, result: PDFExtractResult): void {
  extractionMemoryCache.set(cacheKey, { cachedAt: Date.now(), result });
  evictMemoryCacheIfNeeded();
}

async function readFromDiskCache(cacheKey: string): Promise<PDFExtractResult | null> {
  try {
    const filePath = path.join(EXTRACTION_CACHE_DIR, `${cacheKey}.json`);
    if (!existsSync(filePath)) return null;

    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed?.cachedAt || !parsed.result) return null;
    if (Date.now() - parsed.cachedAt > DISK_CACHE_TTL_MS) return null;

    return parsed.result;
  } catch {
    return null;
  }
}

async function writeToDiskCache(cacheKey: string, result: PDFExtractResult): Promise<void> {
  try {
    await mkdir(EXTRACTION_CACHE_DIR, { recursive: true });
    const payload: CacheEnvelope = {
      cachedAt: Date.now(),
      result,
    };
    const filePath = path.join(EXTRACTION_CACHE_DIR, `${cacheKey}.json`);
    await writeFile(filePath, JSON.stringify(payload), 'utf8');
  } catch {
    // Disk cache is best effort only.
  }
}

async function extractWithPdfJs(buffer: Buffer): Promise<PDFExtractResult> {
  const pdfjs = await getPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdfDoc = await loadingTask.promise;
  const maxPages = Math.min(pdfDoc.numPages, MAX_PAGES);

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => item?.str ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      pageTexts.push(text);
    }
  }

  let metadata: Record<string, unknown> = {};
  let info: PDFExtractResult['info'] = {};
  try {
    const docMetadata = await pdfDoc.getMetadata();
    metadata = docMetadata.metadata && typeof docMetadata.metadata === 'object'
      ? (docMetadata.metadata as Record<string, unknown>)
      : {};
    info = {
      title: docMetadata.info?.Title,
      author: docMetadata.info?.Author,
      subject: docMetadata.info?.Subject,
      creator: docMetadata.info?.Creator,
      producer: docMetadata.info?.Producer,
      creationDate: docMetadata.info?.CreationDate,
      modificationDate: docMetadata.info?.ModDate,
    };
  } catch {
    // Metadata extraction can fail on malformed PDFs; keep text extraction result.
  }

  await pdfDoc.destroy?.();

  return {
    text: cleanText(pageTexts.join('\n')),
    pageCount: maxPages,
    extractor: 'pdfjs',
    extractedAt: new Date().toISOString(),
    info,
    metadata,
  };
}

async function extractWithPdfParse(buffer: Buffer): Promise<PDFExtractResult> {
  // Lazy-load parser to keep this module safe for build-time route analysis.
  const moduleValue = await import('pdf-parse');
  const parser = ((moduleValue as { default?: unknown }).default ?? moduleValue) as unknown;
  if (typeof parser !== 'function') {
    throw new Error('pdf-parse module did not expose a parser function');
  }

  const parsed = await (parser as (data: Buffer) => Promise<PdfParseResult>)(buffer);
  const pageCount = typeof parsed.numpages === 'number' ? parsed.numpages : 0;
  const info = parsed.info ?? {};
  const metadata = parsed.metadata && typeof parsed.metadata === 'object'
    ? (parsed.metadata as Record<string, unknown>)
    : {};

  return {
    text: cleanText(parsed.text ?? ''),
    pageCount,
    extractor: 'pdf-parse',
    extractedAt: new Date().toISOString(),
    info: {
      title: typeof info.Title === 'string' ? info.Title : undefined,
      author: typeof info.Author === 'string' ? info.Author : undefined,
      subject: typeof info.Subject === 'string' ? info.Subject : undefined,
      creator: typeof info.Creator === 'string' ? info.Creator : undefined,
      producer: typeof info.Producer === 'string' ? info.Producer : undefined,
      creationDate: typeof info.CreationDate === 'string' ? info.CreationDate : undefined,
      modificationDate: typeof info.ModDate === 'string' ? info.ModDate : undefined,
    },
    metadata,
  };
}

function pickBestResult(primary: PDFExtractResult, secondary: PDFExtractResult): PDFExtractResult {
  const primaryLen = primary.text.length;
  const secondaryLen = secondary.text.length;

  if (secondaryLen <= primaryLen) {
    return primary;
  }

  return {
    ...secondary,
    pageCount: Math.max(primary.pageCount, secondary.pageCount),
    extractor: 'combined',
    extractedAt: new Date().toISOString(),
    metadata: {
      ...primary.metadata,
      ...secondary.metadata,
    },
  };
}

// South African document patterns
const SA_PATTERNS = {
  companyRegistration: /\b\d{4}\/\d{6}\/\d{2}\b/g,
  vatNumber: /\b\d{10}\b/g,
  bbbeeLevel: /\b(?:Level\s*)?([1-8])\s*(?:B-BBEE|BBBEE|BEE)\b/gi,
  taxClearance: /\bTax\s*Clearance\s*(?:Certificate|Pin)?\b/gi,
  cidbGrade: /\bCIDB\s*Grade\s*([1-9])\b/gi,
  sarsReference: /\b\d{3}\/\d{3}\/\d{3}\b/g,
  dates: /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b/g,
  amounts: /\bR\s*[\d,]+(?:\.\d{2})?\b/gi,
  expiryDate: /\b(?:expir(?:y|es?)|valid\s*(?:until|to|through))\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/gi,
};

// Document type detection keywords
const DOCUMENT_TYPE_KEYWORDS: Record<string, string[]> = {
  tax: ['tax clearance', 'sars', 'tax compliance', 'income tax', 'vat registration', 'tax certificate'],
  bbbee: ['b-bbee', 'bbbee', 'broad-based', 'black economic empowerment', 'bee certificate', 'transformation'],
  registration: ['cipc', 'company registration', 'certificate of incorporation', 'ck document', 'business registration'],
  legal: ['contract', 'agreement', 'memorandum', 'articles of association', 'shareholders', 'legal'],
  financial: ['financial statement', 'audit', 'balance sheet', 'income statement', 'cash flow', 'annual report'],
  certification: ['iso', 'certificate', 'accreditation', 'compliance certificate', 'quality management'],
  insurance: ['insurance', 'indemnity', 'liability', 'cover note', 'policy'],
  cidb: ['cidb', 'construction industry', 'grading', 'contractor registration'],
  csd: ['central supplier database', 'csd supplier', 'supplier summary', 'supplier number', 'maaa'],
};

function getLineValue(text: string, labels: string[]): string | null {
  const labelPattern = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = text.match(new RegExp(`(?:${labelPattern})\\s*[:\\-]?\\s*([^\\n\\r]{2,120})`, 'i'));
  if (!match?.[1]) return null;
  const value = match[1]
    .replace(/\s{2,}.*/, '')
    .replace(/\b(?:registration number|tax number|vat number|supplier number)\b.*$/i, '')
    .trim();
  return value || null;
}

function getBooleanValue(text: string, labels: string[]): boolean | null {
  const raw = getLineValue(text, labels);
  if (!raw) return null;
  if (/\b(?:yes|verified|valid|compliant|active|true)\b/i.test(raw)) return true;
  if (/\b(?:no|not verified|invalid|non-compliant|inactive|false)\b/i.test(raw)) return false;
  return null;
}

function parseCsdSupplierSummary(text: string): CsdSupplierSummaryAnalysis {
  const supplierNumber = text.match(/\bMAAA\d{6,}\b/i)?.[0]?.toUpperCase() ?? null;
  const isCsdSupplierSummary = Boolean(
    supplierNumber
    || /central supplier database/i.test(text)
    || /csd\s+supplier\s+summary/i.test(text)
    || (/supplier\s+number/i.test(text) && /\bCSD\b/i.test(text))
  );

  const registrationNumber = text.match(SA_PATTERNS.companyRegistration)?.[0] ?? null;
  const vatNumber = text.match(SA_PATTERNS.vatNumber)?.[0] ?? null;
  const bbbeeLevel = text.match(SA_PATTERNS.bbbeeLevel)?.[0]?.trim() ?? null;
  const cidbGrade = text.match(SA_PATTERNS.cidbGrade)?.[0]?.trim() ?? null;
  const taxNumber = getLineValue(text, ['Income Tax Number', 'Tax Number', 'Tax Reference Number']);

  const summary: Omit<CsdSupplierSummaryAnalysis, 'fieldsComplete' | 'fieldsTotal' | 'completenessScore'> = {
    isCsdSupplierSummary,
    supplierNumber,
    legalName: getLineValue(text, ['Legal Name', 'Supplier Legal Name', 'Enterprise Name', 'Registered Name']),
    tradingName: getLineValue(text, ['Trading Name', 'Trade Name']),
    registrationNumber,
    taxNumber,
    vatNumber,
    bbbeeLevel,
    cidbGrade,
    province: getLineValue(text, ['Province', 'Physical Province']),
    municipality: getLineValue(text, ['Municipality', 'Local Municipality']),
    bankAccountVerified: getBooleanValue(text, ['Bank Account Verified', 'Bank Verification Status', 'Banking Details Verified']),
    taxCompliant: getBooleanValue(text, ['Tax Compliant', 'Tax Compliance Status', 'SARS Tax Status']),
    active: getBooleanValue(text, ['Supplier Status', 'CSD Status', 'Active']),
  };

  const scoredFields: Array<keyof typeof summary> = [
    'supplierNumber',
    'legalName',
    'registrationNumber',
    'taxNumber',
    'vatNumber',
    'bbbeeLevel',
    'province',
    'municipality',
    'bankAccountVerified',
    'taxCompliant',
    'active',
  ];
  const fieldsComplete = scoredFields.filter((field) => summary[field] !== null && summary[field] !== '').length;
  const fieldsTotal = scoredFields.length;

  return {
    ...summary,
    fieldsComplete,
    fieldsTotal,
    completenessScore: isCsdSupplierSummary ? Math.round((fieldsComplete / fieldsTotal) * 100) : 0,
  };
}

/**
 * Extract text and metadata from a PDF buffer.
 * Uses a layered strategy:
 * 1) memory cache
 * 2) disk cache
 * 3) pdfjs extraction
 * 4) pdf-parse fallback when pdfjs output is weak
 */
export async function extractPDFContent(buffer: Buffer): Promise<PDFExtractResult> {
  const cacheKey = hashBuffer(buffer);

  const memoryHit = readFromMemoryCache(cacheKey);
  if (memoryHit) {
    return memoryHit;
  }

  const diskHit = await readFromDiskCache(cacheKey);
  if (diskHit) {
    writeToMemoryCache(cacheKey, diskHit);
    return diskHit;
  }

  // Attempt pdfjs extraction; on any failure cascade to pdf-parse.
  let pdfjsResult: PDFExtractResult | null = null;
  try {
    pdfjsResult = await extractWithPdfJs(buffer);
  } catch (pdfjsError) {
    console.warn('pdfjs extraction failed, will try pdf-parse:', pdfjsError);
  }

  // Use pdf-parse if pdfjs failed entirely or produced weak output.
  const pdfjsTextLen = pdfjsResult?.text.length ?? 0;
  if (!pdfjsResult || pdfjsTextLen < 200) {
    try {
      const pdfParseResult = await extractWithPdfParse(buffer);
      const finalResult = pdfjsResult
        ? pickBestResult(pdfjsResult, pdfParseResult)
        : pdfParseResult;
      writeToMemoryCache(cacheKey, finalResult);
      await writeToDiskCache(cacheKey, finalResult);
      return finalResult;
    } catch (fallbackError) {
      console.warn('pdf-parse fallback also failed:', fallbackError);
    }
  }

  // Return whatever pdfjs produced, even if weak (or empty on total failure).
  const finalResult = pdfjsResult ?? {
    text: '',
    pageCount: 0,
    extractor: 'pdfjs' as PdfExtractEngine,
    extractedAt: new Date().toISOString(),
    info: {},
    metadata: {},
  };
  writeToMemoryCache(cacheKey, finalResult);
  await writeToDiskCache(cacheKey, finalResult);
  return finalResult;
}

/**
 * Analyze document content for compliance matching
 */
export function analyzeDocumentContent(text: string, pageCount: number): DocumentAnalysis {
  const normalizedText = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const csdSupplierSummary = parseCsdSupplierSummary(text);

  // Extract patterns
  const detectedDates = text.match(SA_PATTERNS.dates) ?? [];
  const detectedAmounts = text.match(SA_PATTERNS.amounts) ?? [];
  const hasCompanyReg = (text.match(SA_PATTERNS.companyRegistration) ?? []).length > 0;
  const hasVat = (text.match(SA_PATTERNS.vatNumber) ?? []).length > 0;
  const hasBBBEE = (text.match(SA_PATTERNS.bbbeeLevel) ?? []).length > 0;

  // Detect document type
  let documentType: string | null = null;
  let maxScore = 0;

  for (const [type, keywords] of Object.entries(DOCUMENT_TYPE_KEYWORDS)) {
    const score = keywords.filter((kw) => normalizedText.includes(kw)).length;
    if (score > maxScore) {
      maxScore = score;
      documentType = type;
    }
  }

  if (csdSupplierSummary.isCsdSupplierSummary) {
    documentType = 'csd';
    maxScore = Math.max(maxScore, 3);
  }

  // Extract keywords (common compliance-related terms)
  const complianceKeywords = [
    'compliant', 'valid', 'verified', 'approved', 'certified', 'registered',
    'tax clearance', 'bbbee', 'cidb', 'cipc', 'sars', 'tender', 'bid',
    'qualification', 'eligibility', 'requirement', 'declaration',
  ];
  const keywords = complianceKeywords.filter((kw) => normalizedText.includes(kw));
  if (csdSupplierSummary.isCsdSupplierSummary && !keywords.includes('csd supplier summary')) {
    keywords.push('csd supplier summary');
  }

  // Calculate confidence based on detected patterns
  const signalCount = [
    hasCompanyReg,
    hasVat,
    hasBBBEE,
    detectedDates.length > 0,
    keywords.length > 2,
    documentType !== null,
    csdSupplierSummary.isCsdSupplierSummary,
  ].filter(Boolean).length;

  const confidence = Math.min(signalCount / 7, 1);

  return {
    extractedText: text,
    pageCount,
    wordCount: words.length,
    characterCount: text.length,
    hasSignature: /signature|signed|authorized/i.test(text),
    hasDate: detectedDates.length > 0,
    hasCompanyName: /(?:pty|ltd|limited|cc|inc)/i.test(text),
    hasRegistrationNumber: hasCompanyReg,
    hasVatNumber: hasVat,
    hasBBBEELevel: hasBBBEE,
    detectedDates: [...new Set(detectedDates)].slice(0, 10),
    detectedAmounts: [...new Set(detectedAmounts)].slice(0, 10),
    documentType,
    confidence,
    keywords,
    csdSupplierSummary: csdSupplierSummary.isCsdSupplierSummary ? csdSupplierSummary : undefined,
  };
}

/**
 * Extract expiry date from document text if present
 */
export function extractExpiryDate(text: string): string | null {
  const match = text.match(SA_PATTERNS.expiryDate);
  if (!match) return null;

  // Try to parse the date
  const dateStr = match[0].replace(/expir(?:y|es?)|valid\s*(?:until|to|through)|[:\-]/gi, '').trim();

  // Simple date parsing - prefer ISO format output
  const parts = dateStr.match(/(\d{1,4})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (!parts) return null;

  const [, a, b, c] = parts;
  let year: number;
  let month: number;
  let day: number;

  // Determine format (YYYY-MM-DD vs DD-MM-YYYY)
  if (parseInt(a, 10) > 31) {
    // YYYY-MM-DD
    year = parseInt(a, 10);
    month = parseInt(b, 10);
    day = parseInt(c, 10);
  } else {
    // DD-MM-YYYY
    day = parseInt(a, 10);
    month = parseInt(b, 10);
    year = parseInt(c, 10);
    if (year < 100) year += 2000;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Extract B-BBEE level from document text
 */
export function extractBBBEELevel(text: string): number | null {
  const match = text.match(SA_PATTERNS.bbbeeLevel);
  if (!match) return null;

  const levelMatch = match[0].match(/[1-8]/);
  return levelMatch ? parseInt(levelMatch[0], 10) : null;
}

/**
 * Extract CIDB grade from document text
 */
export function extractCIDBGrade(text: string): string | null {
  const match = text.match(SA_PATTERNS.cidbGrade);
  if (!match) return null;

  const gradeMatch = match[0].match(/[1-9]/);
  return gradeMatch ? gradeMatch[0] : null;
}

/**
 * Check if document appears to be a valid compliance document
 */
export function isValidComplianceDocument(analysis: DocumentAnalysis): boolean {
  // Must have some text content
  if (analysis.wordCount < 10) return false;

  // Should have some compliance signals
  if (analysis.confidence < 0.2) return false;

  // Should be a recognized document type
  if (!analysis.documentType) return false;

  return true;
}

const DOCUMENT_ANALYSIS_PROMPT = `You are analyzing a South African government compliance document.
Analyze the following extracted text and return ONLY a valid JSON object with no markdown formatting:
{
  "documentType": one of ["tax","bbbee","registration","legal","financial","certification","insurance","cidb","csd"] or null,
  "confidence": number between 0 and 1,
  "hasSignature": boolean,
  "hasDate": boolean,
  "hasCompanyName": boolean,
  "hasRegistrationNumber": boolean,
  "hasVatNumber": boolean,
  "hasBBBEELevel": boolean,
  "detectedDates": array of date strings found in the document,
  "detectedAmounts": array of Rand amount strings (e.g. "R 50 000"),
  "keywords": array of compliance-related keywords,
  "expiryDate": "YYYY-MM-DD" string or null,
  "summary": "one sentence description"
}

Document text (first 8000 chars):
`;

/**
 * Analyse document content using the configured OpenRouter model.
 * Always runs the regex baseline first; AI result enriches it.
 * If the AI call fails for any reason, returns the regex baseline silently.
 */
export async function analyzeDocumentWithAI(
  text: string,
  pageCount: number,
): Promise<DocumentAnalysis> {
  const baseline = analyzeDocumentContent(text, pageCount);

  if (!text.trim()) return baseline;

  const result = await chatWithOpenRouter({
    temperature: 0.1,
    maxTokens: 700,
    messages: [
      {
        role: 'system',
        content:
          'You extract structured facts from South African compliance documents. Return only valid JSON. No markdown.',
      },
      {
        role: 'user',
        content: DOCUMENT_ANALYSIS_PROMPT + text.slice(0, 8000),
      },
    ],
  });

  if (!result.ok) return baseline;

  try {
    const raw = result.content
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
    const ai = JSON.parse(raw);

    return {
      ...baseline,
      documentType:          ai.documentType          ?? baseline.documentType,
      confidence:            typeof ai.confidence === 'number' ? ai.confidence : baseline.confidence,
      hasSignature:          ai.hasSignature           ?? baseline.hasSignature,
      hasDate:               ai.hasDate                ?? baseline.hasDate,
      hasCompanyName:        ai.hasCompanyName         ?? baseline.hasCompanyName,
      hasRegistrationNumber: ai.hasRegistrationNumber  ?? baseline.hasRegistrationNumber,
      hasVatNumber:          ai.hasVatNumber           ?? baseline.hasVatNumber,
      hasBBBEELevel:         ai.hasBBBEELevel          ?? baseline.hasBBBEELevel,
      detectedDates:         ai.detectedDates?.length  ? ai.detectedDates   : baseline.detectedDates,
      detectedAmounts:       ai.detectedAmounts?.length ? ai.detectedAmounts : baseline.detectedAmounts,
      keywords:              ai.keywords?.length       ? ai.keywords        : baseline.keywords,
    };
  } catch (err) {
    console.warn('OpenRouter document analysis failed; using regex baseline:', err);
    return baseline;
  }
}

/**
 * Extract expiry date using the configured OpenRouter model. Falls back to regex if AI unavailable or fails.
 */
export async function extractExpiryDateWithAI(text: string): Promise<string | null> {
  if (!text.trim()) return extractExpiryDate(text);

  const result = await chatWithOpenRouter({
    temperature: 0,
    maxTokens: 20,
    messages: [
      {
        role: 'system',
        content: 'Return only an ISO date string in YYYY-MM-DD format, or the exact word null.',
      },
      {
        role: 'user',
        content:
          'Extract only the expiry date or validity end date from this South African compliance document. No other text, no markdown.\n\n' +
          text.slice(0, 4000),
      },
    ],
  });

  if (!result.ok) {
    return extractExpiryDate(text);
  }

  const raw = result.content.trim();
  if (raw === 'null' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return extractExpiryDate(text);
  return raw;
}
