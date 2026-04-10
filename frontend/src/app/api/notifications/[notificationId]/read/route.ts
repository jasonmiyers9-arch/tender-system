import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/apiAuth';

export async function POST(req: Request) {
  const { error } = await requireAuth(req);
  if (error) return error;

  return NextResponse.json({ ok: true });
}
