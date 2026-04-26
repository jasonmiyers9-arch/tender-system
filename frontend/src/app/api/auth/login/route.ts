import { NextResponse } from 'next/server';
import { ensureFirebaseUser, getUserByToken, mapUserToAuthUser } from '@/lib/server/firestoreService';
import { verifyIdToken } from '@/lib/server/firebaseAdmin';
import { rateLimit, RateLimits } from '@/lib/server/rateLimiter';
import { logAuthSuccess, logAuthFailure } from '@/lib/server/securityAudit';

export async function POST(req: Request) {
  // Rate limit authentication attempts (10 per minute)
  const rateLimitError = await rateLimit(req, RateLimits.auth);
  if (rateLimitError) return rateLimitError;

  const body = await req.json();
  const idToken = String(body.idToken ?? '').trim();

  if (!idToken) {
    await logAuthFailure(req, null, 'Missing ID token');
    return NextResponse.json({ detail: 'Firebase ID token is required' }, { status: 400 });
  }

  try {
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

    // Log successful authentication
    await logAuthSuccess(req, user.id, user.email, 'password');

    return NextResponse.json({ token: idToken, user: mapUserToAuthUser(user) });
  } catch (error) {
    await logAuthFailure(req, null, error instanceof Error ? error.message : 'Token verification failed');
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Invalid credentials' }, { status: 401 });
  }
}
