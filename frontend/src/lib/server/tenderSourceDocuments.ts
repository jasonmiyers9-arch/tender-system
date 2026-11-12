import type { TenderDetail, TenderAttachment } from '@/lib/api/types';
import { safeFetch } from './safeUrl';

// A single official document attached to a tender at its source, with the live
// download URL the server-side proxy can fetch.
export interface SourceDocument {
  filename: string;
  url: string;
}

// Only these hosts are fetched when re-resolving a stored tender's official
// documents from its source URL. Restricting the host keeps the download proxy
// from being turned into an open relay for arbitrary URLs.
const OCDS_API_HOSTS = new Set(['ocds-api.etenders.gov.za']);

function isOcdsReleaseUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    return OCDS_API_HOSTS.has(url.hostname) && /\/api\/OCDSReleases\/release\//i.test(url.pathname);
  } catch {
    return false;
  }
}

interface OcdsReleaseDocument {
  url?: string;
  title?: string;
  description?: string;
}

interface OcdsRelease {
  tender?: { documents?: OcdsReleaseDocument[] };
}

// Re-fetches the OCDS release behind a tender's source URL and extracts the
// official document download links. Returns [] on any failure so callers can
// fall back to a generated summary.
async function fetchOcdsSourceDocuments(sourceUrl: string): Promise<SourceDocument[]> {
  try {
    const res = await safeFetch(sourceUrl, {
      headers: { Accept: 'application/json' },
    }, 6000);
    if (!res.ok) return [];
    const release = (await res.json()) as OcdsRelease;
    return (release?.tender?.documents ?? [])
      .filter((doc): doc is OcdsReleaseDocument & { url: string } =>
        typeof doc.url === 'string' && /^https?:\/\//i.test(doc.url))
      .map((doc, index) => ({
        filename: (doc.title || doc.description || `tender-document-${index + 1}.pdf`).trim(),
        url: doc.url,
      }));
  } catch {
    return [];
  }
}

// Resolves the official source documents for a tender that is stored in the
// system (and therefore carries no document URLs of its own) by re-fetching its
// source release. Tenders that were captured while open are kept in the database
// and the live scraper drops them once they close, so the source URL is the only
// remaining way to recover the actual published documents.
export async function resolveStoredTenderDocuments(
  tender: Pick<TenderDetail, 'sourceUrl'> | null,
): Promise<SourceDocument[]> {
  if (isOcdsReleaseUrl(tender?.sourceUrl)) {
    return fetchOcdsSourceDocuments(tender!.sourceUrl!);
  }
  return [];
}

// Builds the URL-free attachment list the company portal renders. The index is
// the position in the resolved document array so the download proxy can resolve
// the exact file by index.
export function sourceDocumentsToAttachments(documents: SourceDocument[]): TenderAttachment[] {
  return documents.map((doc, index) => ({
    index,
    filename: doc.filename || `tender-document-${index + 1}.pdf`,
  }));
}

// A tender document fetched and base64-encoded so it can be sent to the AI model
// for direct reading (multimodal). Mirrors the AiAttachment shape plus a filename
// used in the grounding facts.
export interface TenderDocumentAttachment {
  filename: string;
  mimeType: string;
  data: string;
}

// Caps that keep the AI request within Claude's limits and, crucially, keep the
// whole document-fetch phase short enough that the serverless function still has
// time to make the Claude call within its execution budget. The downloads run
// sequentially, so per-fetch timeouts plus the overall budget bound total time.
const MAX_AI_TENDER_DOCS = 2;
const MAX_AI_DOC_BYTES = 4.5 * 1024 * 1024;
const MAX_AI_TOTAL_BYTES = 9 * 1024 * 1024;
// Overall wall-clock budget for fetching tender PDFs. Once exceeded, stop fetching
// and let the advisor answer with whatever documents were retrieved (or none) so
// the request always leaves enough of the function's budget for the Claude call.
const MAX_AI_FETCH_BUDGET_MS = 9000;

function looksLikePdf(doc: SourceDocument): boolean {
  return /\.pdf($|\?)/i.test(doc.url) || /\.pdf$/i.test(doc.filename);
}

async function fetchPdfBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await safeFetch(url, {
      headers: { Accept: 'application/pdf,*/*' },
    }, 6000);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    const isPdf = contentType.includes('pdf') || contentType.includes('octet-stream') || /\.pdf($|\?)/i.test(url);
    if (!isPdf) return null;
    const body = await res.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_AI_DOC_BYTES) return null;
    return body;
  } catch {
    return null;
  }
}

// Fetches a tender's official PDF documents and returns them base64-encoded so the
// AI can read the actual tender requirements directly and check them against the
// company's compliance documents. Bounded in count and size to stay within model
// limits; failures are skipped so the advisor always still answers.
export async function fetchTenderDocumentsForAi(
  documents: SourceDocument[],
): Promise<TenderDocumentAttachment[]> {
  const pdfs = documents.filter((doc) => /^https?:\/\//i.test(doc.url) && looksLikePdf(doc)).slice(0, MAX_AI_TENDER_DOCS);

  const attachments: TenderDocumentAttachment[] = [];
  let totalBytes = 0;
  const deadline = Date.now() + MAX_AI_FETCH_BUDGET_MS;
  for (const doc of pdfs) {
    // Stop fetching once the budget is spent so the caller keeps enough of the
    // function's execution time to actually call the model.
    if (Date.now() >= deadline) break;
    const bytes = await fetchPdfBytes(doc.url);
    if (!bytes) continue;
    if (totalBytes + bytes.byteLength > MAX_AI_TOTAL_BYTES) break;
    totalBytes += bytes.byteLength;
    attachments.push({
      filename: doc.filename || `tender-document-${attachments.length + 1}.pdf`,
      mimeType: 'application/pdf',
      data: Buffer.from(bytes).toString('base64'),
    });
  }
  return attachments;
}
