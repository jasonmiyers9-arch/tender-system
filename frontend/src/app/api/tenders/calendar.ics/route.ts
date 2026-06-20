import { NextResponse } from 'next/server';
import { listTenders } from '@/lib/server/firestoreService';

export async function GET() {
  const tenders = await listTenders();
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tender Guard Pro//Tender Calendar//EN'];

  for (const tender of tenders) {
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
