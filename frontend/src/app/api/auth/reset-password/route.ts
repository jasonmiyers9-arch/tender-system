import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const token = String(body.token ?? '').trim();
  const password = String(body.password ?? '').trim();
  if (!token || !password) {
    return NextResponse.json({ detail: 'Token and new password are required' }, { status: 400 });
  }
  return NextResponse.json({ success: true, message: 'Password reset successful.' });
}
