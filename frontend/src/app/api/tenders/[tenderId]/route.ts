import { NextResponse } from 'next/server';
import { getTenderById } from '@/lib/server/firestoreService';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const { tenderId } = await params;
  const tender = await getTenderById(tenderId);
  if (!tender) {
    return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
  }
  return NextResponse.json(tender, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
    },
  });
}
