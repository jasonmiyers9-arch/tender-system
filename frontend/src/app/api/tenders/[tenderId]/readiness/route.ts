import { NextResponse } from 'next/server';
import { getTenderReadiness } from '@/lib/server/firestoreService';
import { requireAuth } from '@/lib/server/apiAuth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const { error } = await requireAuth(req);
  if (error) return error;

  const { tenderId } = await params;
  const readiness = await getTenderReadiness(tenderId);
  if (!readiness) {
    return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
  }
  return NextResponse.json(readiness, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
    },
  });
}
