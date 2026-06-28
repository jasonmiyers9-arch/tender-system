import { NextResponse } from 'next/server';
import { listTenders, getUserByToken, getCompanyById } from '@/lib/server/firestoreService';
import { enrichTenderWithCompanyScore } from '@/lib/server/tenderScoring';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(req: Request) {
  const tenders = await listTenders();

  // Resolve company context so the calendar's match score matches the matches
  // list and tender detail page (instead of the raw stored score).
  const token = parseToken(req);
  const user = token ? await getUserByToken(token) : null;
  const companyId = user?.activeCompanyId ?? undefined;
  const companyCategories = companyId ? (await getCompanyById(companyId))?.tenderCategories ?? [] : [];

  const scored = companyId
    ? await Promise.all(tenders.map((tender) => enrichTenderWithCompanyScore(tender, companyId, companyCategories)))
    : tenders;

  const items = scored.map((tender) => ({
    id: `tender-${tender.id}`,
    title: tender.title,
    date: tender.deadline,
    type: 'deadline' as const,
    organization: tender.organization,
    matchScore: tender.matchScore,
    priority: tender.matchScore >= 85 ? 'high' : tender.matchScore >= 65 ? 'medium' : 'low',
    gapsCount: tender.gaps.length,
  }));

  return NextResponse.json({ items }, {
    status: 200,
    headers: {
      'Cache-Control': companyId
        ? 'private, max-age=30, stale-while-revalidate=60'
        : 'public, max-age=60, stale-while-revalidate=120',
    },
  });
}
