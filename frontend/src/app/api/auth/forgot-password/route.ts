import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/server/firestoreService';
import { generatePasswordResetLink } from '@/lib/server/firebaseAdmin';
import { passwordResetEmailBody, sendAuthEmail } from '@/lib/server/authEmail';
import { rateLimit, RateLimits } from '@/lib/server/rateLimiter';

export async function POST(req: Request) {
  const rateLimitError = await rateLimit(req, RateLimits.strict);
  if (rateLimitError) return rateLimitError;

  const body = await req.json();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ detail: 'Email is required' }, { status: 400 });
  }
  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ success: true, message: 'If that email exists, we sent password reset instructions.' });
    }

    const resetLink = await generatePasswordResetLink(email);
    const delivery = await sendAuthEmail({
      to: email,
      subject: 'Reset your Tender Guard Pro password',
      body: passwordResetEmailBody(resetLink),
    });

    return NextResponse.json({
      success: true,
      message: 'If that email exists, we sent password reset instructions.',
      ...(process.env.NODE_ENV !== 'production' ? { resetLink, deliveryReason: delivery.reason ?? null } : {}),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { detail: error instanceof Error ? error.message : 'Password reset failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'If that email exists, we sent password reset instructions.' });
  }
}
