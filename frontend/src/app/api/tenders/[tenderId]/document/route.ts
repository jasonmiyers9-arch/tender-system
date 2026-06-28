import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/apiAuth';
import { resolveTender } from '@/lib/server/tenderResolver';
import { generateTenderDocumentPdf, tenderDocumentFilename } from '@/lib/server/tenderDocumentPdf';
import { resolveStoredTenderDocuments, type SourceDocument } from '@/lib/server/tenderSourceDocuments';

// Picks the best original PDF from a tender's official documents, if any.
function pickSourcePdf(documents: SourceDocument[]): SourceDocument | null {
  const candidates = documents.filter((doc) => /^https?:\/\//i.test(doc.url));
  if (!candidates.length) return null;
  const pdf = candidates.find((doc) => /\.pdf($|\?)/i.test(doc.url) || /\.pdf$/i.test(doc.filename));
  return pdf ?? candidates[0];
}

// Tries to stream the real source PDF so the company gets the official document.
async function fetchSourcePdf(url: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'TenderGuardPro/1.0 (+https://tender-gaurd-pro.netlify.app)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    const isPdf = contentType.includes('pdf') || contentType.includes('octet-stream') || /\.pdf($|\?)/i.test(url);
    if (!isPdf) return null;
    const body = await res.arrayBuffer();
    if (body.byteLength === 0) return null;
    return { body, contentType: contentType.includes('pdf') ? contentType : 'application/pdf' };
  } catch {
    return null;
  }
}

// Streams an attached file of any type (PDF, Word, spreadsheet, archive). Used
// when the company downloads a specific document from a tender's attachment list.
async function fetchSourceFile(url: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'TenderGuardPro/1.0 (+https://tender-gaurd-pro.netlify.app)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const body = await res.arrayBuffer();
    if (body.byteLength === 0) return null;
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    return { body, contentType };
  } catch {
    return null;
  }
}

function sanitizeFilename(name: string, fallback: string): string {
  const cleaned = name.replace(/[\r\n"]/g, '').trim();
  return cleaned || fallback;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> },
) {
  const { user, error } = await requireAuth(req);
  if (error) return error;
  void user;

  const { tenderId } = await params;
  const { tender, scrapedTender } = await resolveTender(tenderId);

  if (!tender) {
    return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
  }

  // Resolve the official documents for this tender. A live scraped tender carries
  // its document URLs directly (indices kept in step with the attachment list); a
  // stored tender (kept after it closed and dropped by the scraper) has none, so
  // re-fetch them from its source release.
  const sourceDocuments: SourceDocument[] = scrapedTender?.documents?.length
    ? scrapedTender.documents.map((doc, index) => ({
        filename: doc.filename || `tender-document-${index + 1}.pdf`,
        url: doc.url,
      }))
    : await resolveStoredTenderDocuments(tender);

  // A specific attachment was requested — stream that exact file.
  const indexParam = new URL(req.url).searchParams.get('index');
  if (indexParam !== null) {
    const index = Number(indexParam);
    const doc = Number.isInteger(index) ? sourceDocuments[index] : undefined;
    if (!doc || !/^https?:\/\//i.test(doc.url)) {
      return NextResponse.json({ detail: 'Attached document not found' }, { status: 404 });
    }
    const fetched = await fetchSourceFile(doc.url);
    if (!fetched) {
      return NextResponse.json(
        { detail: 'The attached document could not be retrieved from the source.' },
        { status: 502 },
      );
    }
    const name = sanitizeFilename(doc.filename, `tender-document-${index + 1}.pdf`);
    return new NextResponse(fetched.body, {
      status: 200,
      headers: {
        'Content-Type': fetched.contentType,
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const filename = tenderDocumentFilename(tender);

  // Prefer the official source PDF when the tender has one attached.
  const sourcePdf = pickSourcePdf(sourceDocuments);
  if (sourcePdf) {
    const fetched = await fetchSourcePdf(sourcePdf.url);
    if (fetched) {
      const sourceName = /\.pdf$/i.test(sourcePdf.filename) ? sourcePdf.filename : filename;
      return new NextResponse(fetched.body, {
        status: 200,
        headers: {
          'Content-Type': fetched.contentType,
          'Content-Disposition': `attachment; filename="${sourceName.replace(/"/g, '')}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }
  }

  // Fall back to a generated tender-information PDF so every tender is downloadable.
  const pdf = generateTenderDocumentPdf(tender, scrapedTender);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
