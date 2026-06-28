import type { TenderDetail, TenderAttachment } from '@/lib/api/types';

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(sourceUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'TenderGuardPro/1.0 (+https://tender-gaurd-pro.netlify.app)',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);
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
