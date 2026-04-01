import { NextResponse } from 'next/server';
import { listTenders } from '@/lib/server/firestoreService';

export async function GET() {
  const tenders = await listTenders();
  const items = tenders.map((tender) => ({
    id: `tender-${tender.id}`,
    title: tender.title,
    date: tender.deadline,
    type: 'deadline' as const,
    organization: tender.organization,
    matchScore: tender.matchScore,
    priority: tender.matchScore >= 80 ? 'high' : tender.matchScore >= 60 ? 'medium' : 'low',
    gapsCount: tender.gaps.length,
  }));

  return NextResponse.json({ items }, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
    },
  });
}
