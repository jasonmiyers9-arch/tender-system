import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const token = String(body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ detail: 'Verification token is required' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
