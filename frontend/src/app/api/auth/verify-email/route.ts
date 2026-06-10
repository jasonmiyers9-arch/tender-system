import { NextResponse } from 'next/server';
import { applyEmailVerificationCode } from '@/lib/server/firebaseActionCodes';

export async function POST(req: Request) {
  const body = await req.json();
  const token = String(body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ detail: 'Verification token is required' }, { status: 400 });
  }

  try {
    const result = await applyEmailVerificationCode(token);
    return NextResponse.json({ ok: true, email: result.email ?? null });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Email verification failed' },
      { status: 400 },
    );
  }
}
