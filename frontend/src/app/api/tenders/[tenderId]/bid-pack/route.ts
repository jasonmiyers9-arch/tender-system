import { NextResponse } from 'next/server';
import { getCompanyById, listDocumentsForCompany } from '@/lib/server/firestoreService';
import { requireAuth, resolveCompanyContext } from '@/lib/server/apiAuth';
import { bidPackFilename, buildBidPack, renderBidPackHtml } from '@/lib/server/bidPack';
import { resolveTender } from '@/lib/server/tenderResolver';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> },
) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const { tenderId } = await params;
  const companyId = await resolveCompanyContext(user!.id, user!.activeCompanyId);
  if (!companyId) {
    return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
  }

  const [{ tender, scrapedTender }, company, documents] = await Promise.all([
    resolveTender(tenderId),
    getCompanyById(companyId),
    listDocumentsForCompany(companyId),
  ]);

  if (!tender) {
    return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
  }
  if (!company) {
    return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
  }

  const pack = buildBidPack({ company, tender, documents, scrapedTender });
  const format = new URL(req.url).searchParams.get('format');

  if (format === 'html') {
    return new NextResponse(renderBidPackHtml(pack), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${bidPackFilename(company.name, tender.title)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return NextResponse.json(pack, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  });
}
