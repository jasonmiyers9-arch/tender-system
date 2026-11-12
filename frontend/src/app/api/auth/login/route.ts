import { NextResponse } from 'next/server';
import { ensureFirebaseUser, getUserByEmail, getUserByToken, mapUserToAuthUserWithOnboarding } from '@/lib/server/firestoreService';
import { isFirebaseAdminConfigured, verifyIdToken } from '@/lib/server/firebaseAdmin';
import { rateLimit, RateLimits } from '@/lib/server/rateLimiter';
import { logAuthSuccess, logAuthFailure } from '@/lib/server/securityAudit';
import { isAdminRole } from '@/lib/server/apiAuth';
import { accountAccessDetail, signLocalDevSession, verifyStoredPassword } from '@/lib/server/accountPolicy';

export async function POST(req: Request) {
  // Rate limit authentication attempts (10 per minute)
  const rateLimitError = await rateLimit(req, RateLimits.auth);
  if (rateLimitError) return rateLimitError;

  const body = await req.json();
  const idToken = String(body.idToken ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '').trim();

  if (!idToken && (!email || !password)) {
    await logAuthFailure(req, null, 'Missing ID token');
    return NextResponse.json({ detail: 'Firebase ID token or email/password is required' }, { status: 400 });
  }

  try {
    if (!isFirebaseAdminConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ detail: 'Firebase authentication is required' }, { status: 503 });
      }
      const user = await getUserByEmail(email);
      if (!user || !verifyStoredPassword(password, user.password)) {
        await logAuthFailure(req, email || null, 'Invalid local credentials');
        return NextResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
      }
      const accessDetail = accountAccessDetail(user);
      if (accessDetail) {
        await logAuthFailure(req, user.email, accessDetail);
        return NextResponse.json({ detail: accessDetail }, { status: 403 });
      }
      if (isAdminRole(user.role)) {
        await logAuthFailure(req, user.email, 'Admin attempted public login');
        return NextResponse.json({ detail: 'admin_portal_required' }, { status: 403 });
      }
      await logAuthSuccess(req, user.id, user.email, 'password');
      return NextResponse.json({ token: signLocalDevSession(user.id), user: await mapUserToAuthUserWithOnboarding(user) });
    }

    const decoded = await verifyIdToken(idToken);
    if (!decoded.email) {
      await logAuthFailure(req, null, 'No email in token');
      return NextResponse.json({ detail: 'Authenticated email is required' }, { status: 400 });
    }

    let user = await getUserByToken(idToken);
    if (!user) {
      await ensureFirebaseUser({
        uid: decoded.uid,
        email: decoded.email,
        fullName: decoded.name ?? decoded.email.split('@')[0],
        role: 'company',
      });
      user = await getUserByToken(idToken);
    }

    if (!user) {
      await logAuthFailure(req, decoded.email, 'Failed to load user profile');
      return NextResponse.json({ detail: 'Unable to load user profile' }, { status: 500 });
    }

    const accessDetail = accountAccessDetail(user);
    if (accessDetail) {
      await logAuthFailure(req, user.email, accessDetail);
      return NextResponse.json({ detail: accessDetail }, { status: 403 });
    }

    if (isAdminRole(user.role)) {
      await logAuthFailure(req, user.email, 'Admin attempted public login');
      return NextResponse.json({ detail: 'admin_portal_required' }, { status: 403 });
    }

    // Log successful authentication
    await logAuthSuccess(req, user.id, user.email, 'password');

    return NextResponse.json({ token: idToken, user: await mapUserToAuthUserWithOnboarding(user) });
  } catch (error) {
    await logAuthFailure(req, null, error instanceof Error ? error.message : 'Token verification failed');
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Invalid credentials' }, { status: 401 });
  }
}
