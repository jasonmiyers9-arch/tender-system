import { NextResponse } from 'next/server';
import { listTenders } from '@/lib/server/firestoreService';

export async function GET() {
  const items = await listTenders();
  return NextResponse.json(items, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
    },
  });
}
