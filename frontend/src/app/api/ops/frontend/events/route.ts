import { NextResponse } from 'next/server';
import { getFrontendEvents } from '../monitorStore';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit')) || 20;
  const items = getFrontendEvents(limit);
  return NextResponse.json({ items });
}
