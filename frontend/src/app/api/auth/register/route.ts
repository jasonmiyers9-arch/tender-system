import { NextResponse } from 'next/server';
import { createUser } from '@/lib/server/firestoreService';
import { verifyIdToken } from '@/lib/server/firebaseAdmin';
import { rateLimit, RateLimits } from '@/lib/server/rateLimiter';
import { logSecurityEvent, SecurityEventType, extractRequestContext } from '@/lib/server/securityAudit';

export async function POST(req: Request) {
  // Rate limit registration attempts (stricter limit)
  const rateLimitError = await rateLimit(req, RateLimits.strict);
  if (rateLimitError) return rateLimitError;

  const data = await req.json();
  const idToken = String(data.idToken ?? '').trim();
  const name = String(data.name ?? '').trim();
  const email = String(data.email ?? '').trim().toLowerCase();
  const role = String(data.role ?? 'company');
  const companyName = data.company_name ? String(data.company_name).trim() : undefined;
  const registrationNumber = data.registration_number ? String(data.registration_number).trim() : undefined;
  const phone = data.phone ? String(data.phone).trim() : undefined;
  const tenderCategories = Array.isArray(data.tender_categories)
    ? data.tender_categories.map((c: unknown) => String(c).trim()).filter(Boolean)
    : undefined;

  if (!idToken || !name || !email) {
    return NextResponse.json({ detail: 'Firebase token, name and email are required' }, { status: 400 });
  }

  const ctx = extractRequestContext(req);

  try {
    const decoded = await verifyIdToken(idToken);
    if (decoded.uid && decoded.email?.toLowerCase() !== email) {
      await logSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_REQUEST,
        outcome: 'blocked',
        userEmail: email,
        ...ctx,
        details: {
          reason: 'Email mismatch during registration',
          providedEmail: email,
          tokenEmail: decoded.email,
        },
      });
      return NextResponse.json({ detail: 'Authenticated email does not match registration email' }, { status: 400 });
    }

    const user = await createUser({
      uid: decoded.uid,
      name,
      email,
      role,
      companyName,
      registrationNumber,
      phone,
      tenderCategories,
    });

    // Log successful registration
    await logSecurityEvent({
      type: SecurityEventType.AUTH_REGISTER,
      outcome: 'success',
      userId: user.id,
      userEmail: email,
      ...ctx,
      details: { role, companyName },
    });

    return NextResponse.json({
      status: 'approved',
      message: 'Account created with Firebase Auth and saved to Firestore.',
      verifyLink: null,
      user,
    });
  } catch (error) {
    await logSecurityEvent({
      type: SecurityEventType.AUTH_REGISTER,
      outcome: 'failure',
      userEmail: email,
      errorMessage: error instanceof Error ? error.message : 'Registration failed',
      ...ctx,
    });
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Registration failed' }, { status: 400 });
  }
}
