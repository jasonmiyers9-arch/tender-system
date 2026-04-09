/**
 * PDF Text Extraction Service
 * Extracts text content from PDF documents for compliance analysis and AI matching.
 * Follows government-class standards for document processing.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
};

/**
 * Extract text and metadata from a PDF buffer
 */
export async function extractPDFContent(buffer: Buffer): Promise<PDFExtractResult> {
  try {
    const pdfjs = await getPdfJs();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: false,
    });
    const pdfDoc = await loadingTask.promise;
    const maxPages = Math.min(pdfDoc.numPages, 100);

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
      text: pageTexts.join('\n').trim(),
      pageCount: maxPages,
      info,
      metadata,
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    return {
      text: '',
      pageCount: 0,
      info: {},
      metadata: {},
    };
  }
}

/**
 * Analyze document content for compliance matching
 */
export function analyzeDocumentContent(text: string, pageCount: number): DocumentAnalysis {
  const normalizedText = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  
  // Extract patterns
  const detectedDates = text.match(SA_PATTERNS.dates) ?? [];
  const detectedAmounts = text.match(SA_PATTERNS.amounts) ?? [];
  const hasCompanyReg = SA_PATTERNS.companyRegistration.test(text);
  const hasVat = SA_PATTERNS.vatNumber.test(text);
  const hasBBBEE = SA_PATTERNS.bbbeeLevel.test(text);
  
  // Detect document type
  let documentType: string | null = null;
  let maxScore = 0;
  
  for (const [type, keywords] of Object.entries(DOCUMENT_TYPE_KEYWORDS)) {
    const score = keywords.filter(kw => normalizedText.includes(kw)).length;
    if (score > maxScore) {
      maxScore = score;
      documentType = type;
    }
  }

  // Extract keywords (common compliance-related terms)
  const complianceKeywords = [
    'compliant', 'valid', 'verified', 'approved', 'certified', 'registered',
    'tax clearance', 'bbbee', 'cidb', 'cipc', 'sars', 'tender', 'bid',
    'qualification', 'eligibility', 'requirement', 'declaration'
  ];
  const keywords = complianceKeywords.filter(kw => normalizedText.includes(kw));

  // Calculate confidence based on detected patterns
  const signalCount = [
    hasCompanyReg,
    hasVat,
    hasBBBEE,
    detectedDates.length > 0,
    keywords.length > 2,
    documentType !== null,
  ].filter(Boolean).length;
  
  const confidence = Math.min(signalCount / 6, 1);

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
  
  let [, a, b, c] = parts;
  let year: number, month: number, day: number;
  
  // Determine format (YYYY-MM-DD vs DD-MM-YYYY)
  if (parseInt(a) > 31) {
    // YYYY-MM-DD
    year = parseInt(a);
    month = parseInt(b);
    day = parseInt(c);
  } else {
    // DD-MM-YYYY
    day = parseInt(a);
    month = parseInt(b);
    year = parseInt(c);
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
  return levelMatch ? parseInt(levelMatch[0]) : null;
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
