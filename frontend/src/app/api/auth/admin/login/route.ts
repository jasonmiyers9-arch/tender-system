import { NextResponse } from 'next/server';
import { getUserByEmail, getUserByToken, mapUserToAuthUser } from '@/lib/server/firestoreService';
import { isFirebaseAdminConfigured, verifyIdToken } from '@/lib/server/firebaseAdmin';
import { rateLimit, RateLimits } from '@/lib/server/rateLimiter';
import { logAuthFailure, logAuthSuccess } from '@/lib/server/securityAudit';
import { isAdminRole } from '@/lib/server/apiAuth';

export async function POST(req: Request) {
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
      const user = await getUserByEmail(email);
      if (!user || user.password !== password) {
        await logAuthFailure(req, email || null, 'Invalid local admin credentials');
        return NextResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
      }
      if (!isAdminRole(user.role)) {
        await logAuthFailure(req, user.email, 'Non-admin attempted admin login');
        return NextResponse.json({ detail: 'admin_access_required' }, { status: 403 });
      }

      if (user.isActive === false || user.deletionRequestedAt) {
        return NextResponse.json({ detail: 'account_inactive' }, { status: 403 });
      }
      await logAuthSuccess(req, user.id, user.email, 'password');
      return NextResponse.json({ token: user.id, user: mapUserToAuthUser(user) });
    }

    const decoded = await verifyIdToken(idToken);
    if (!decoded.email) {
      await logAuthFailure(req, null, 'No email in token');
      return NextResponse.json({ detail: 'Authenticated email is required' }, { status: 400 });
    }

    const user = await getUserByToken(idToken);
    if (!user || !isAdminRole(user.role)) {
      await logAuthFailure(req, decoded.email, 'Non-admin attempted admin login');
      return NextResponse.json({ detail: 'admin_access_required' }, { status: 403 });
    }

    if (user.isActive === false || user.deletionRequestedAt) {
      return NextResponse.json({ detail: 'account_inactive' }, { status: 403 });
    }
    await logAuthSuccess(req, user.id, user.email, 'password');
    return NextResponse.json({ token: idToken, user: mapUserToAuthUser(user) });
  } catch (error) {
    await logAuthFailure(req, null, error instanceof Error ? error.message : 'Token verification failed');
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Invalid credentials' }, { status: 401 });
  }
}
