import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ detail: 'Email is required' }, { status: 400 });
  }
  return NextResponse.json({ success: true, message: 'If that email exists, we sent password reset instructions.' });
}
