import { NextResponse } from 'next/server';
import { createUser } from '@/lib/server/firestoreService';
import { generateEmailVerificationLink, isFirebaseAdminConfigured, verifyIdToken } from '@/lib/server/firebaseAdmin';
import { rateLimit, RateLimits } from '@/lib/server/rateLimiter';
import { logSecurityEvent, SecurityEventType, extractRequestContext } from '@/lib/server/securityAudit';
import { emailVerificationBody, sendAuthEmail } from '@/lib/server/authEmail';

export async function POST(req: Request) {
  // Rate limit registration attempts (stricter limit)
  const rateLimitError = await rateLimit(req, RateLimits.strict);
  if (rateLimitError) return rateLimitError;

  const data = await req.json();
  const idToken = String(data.idToken ?? '').trim();
  const name = String(data.name ?? '').trim();
  const email = String(data.email ?? '').trim().toLowerCase();
  const password = String(data.password ?? '').trim();
  const role = String(data.role ?? 'company');
  const companyName = data.company_name ? String(data.company_name).trim() : undefined;
  const registrationNumber = data.registration_number ? String(data.registration_number).trim() : undefined;
  const phone = data.phone ? String(data.phone).trim() : undefined;
  const tenderCategories = Array.isArray(data.tender_categories)
    ? data.tender_categories.map((c: unknown) => String(c).trim()).filter(Boolean)
    : undefined;

  if (!name || !email) {
    return NextResponse.json({ detail: 'name and email are required' }, { status: 400 });
  }

  if (role === 'admin') {
    return NextResponse.json({ detail: 'admin_registration_disabled' }, { status: 403 });
  }

  const ctx = extractRequestContext(req);

  try {
    const user = isFirebaseAdminConfigured() && idToken
      ? await (async () => {
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
            throw new Error('Authenticated email does not match registration email');
          }

          return createUser({
            uid: decoded.uid,
            name,
            email,
            role,
            companyName,
            registrationNumber,
            phone,
            tenderCategories,
          });
        })()
      : await createUser({
          name,
          email,
          password,
          role,
          companyName,
          registrationNumber,
          phone,
          tenderCategories,
        });

    let verifyLink: string | null = null;
    let verificationEmailSent = false;
    let verificationEmailReason: string | null = null;
    if (isFirebaseAdminConfigured()) {
      try {
        verifyLink = await generateEmailVerificationLink(email);
        const delivery = await sendAuthEmail({
          to: email,
          subject: 'Verify your TenderGuard Pro email',
          body: emailVerificationBody(verifyLink),
        });
        verificationEmailSent = delivery.sent;
        verificationEmailReason = delivery.reason ?? null;
      } catch (verificationError) {
        verificationEmailReason = verificationError instanceof Error
          ? verificationError.message
          : 'Email verification link generation failed';
      }
    } else {
      verificationEmailReason = 'Firebase Admin is not configured';
    }

    // Log successful registration
    await logSecurityEvent({
      type: SecurityEventType.AUTH_REGISTER,
      outcome: 'success',
      userId: user.id,
      userEmail: email,
      ...ctx,
      details: { role, companyName, verificationEmailSent, verificationEmailReason },
    });

    return NextResponse.json({
      status: 'approved',
      message: isFirebaseAdminConfigured()
        ? 'Account created with Firebase Auth and saved to Firestore.'
        : 'Account created locally for development.',
      verifyLink: process.env.NODE_ENV !== 'production' ? verifyLink : null,
      verificationEmailSent,
      verificationEmailReason: process.env.NODE_ENV !== 'production' ? verificationEmailReason : null,
      user,
      token: isFirebaseAdminConfigured() ? idToken : user.id,
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
