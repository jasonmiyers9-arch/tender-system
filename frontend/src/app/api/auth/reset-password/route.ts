import { NextResponse } from 'next/server';
import { confirmPasswordResetCode } from '@/lib/server/firebaseActionCodes';

export async function POST(req: Request) {
  const body = await req.json();
  const token = String(body.token ?? '').trim();
  const password = String(body.password ?? '').trim();
  if (!token || !password) {
    return NextResponse.json({ detail: 'Token and new password are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ detail: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  try {
    const result = await confirmPasswordResetCode(token, password);
    return NextResponse.json({ success: true, message: 'Password reset successful.', email: result.email });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Password reset failed' },
      { status: 400 },
    );
  }
}
