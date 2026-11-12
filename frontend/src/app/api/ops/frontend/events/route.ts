import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { getFrontendEvents } from '../monitorStore';

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit')) || 20;
  const items = getFrontendEvents(limit);
  return NextResponse.json({ items });
}
