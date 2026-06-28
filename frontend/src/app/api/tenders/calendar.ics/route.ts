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

  // Use the company-aware match score so the exported calendar agrees with the app.
  const token = parseToken(req);
  const user = token ? await getUserByToken(token) : null;
  const companyId = user?.activeCompanyId ?? undefined;
  const companyCategories = companyId ? (await getCompanyById(companyId))?.tenderCategories ?? [] : [];
  const scored = companyId
    ? await Promise.all(tenders.map((tender) => enrichTenderWithCompanyScore(tender, companyId, companyCategories)))
    : tenders;

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tender Guard Pro//Tender Calendar//EN'];

  for (const tender of scored) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:tender-${tender.id}@tenderguard.local`);
    lines.push(`DTSTAMP:${nowStamp}`);
    const [year, month, day] = tender.deadline.split('-');
    lines.push(`DTSTART;VALUE=DATE:${year}${month}${day}`);
    lines.push(`SUMMARY:${tender.title} (Match ${tender.matchScore}%)`);
    lines.push(`DESCRIPTION:Organization: ${tender.organization} | Gaps: ${tender.gaps.length}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return new NextResponse(lines.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar',
    },
  });
}
