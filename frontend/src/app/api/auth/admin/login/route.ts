import { NextResponse } from 'next/server';
import { getUserByToken, mapUserToAuthUser } from '@/lib/server/firestoreService';
import { verifyIdToken } from '@/lib/server/firebaseAdmin';
import { rateLimit, RateLimits } from '@/lib/server/rateLimiter';
import { logAuthFailure, logAuthSuccess } from '@/lib/server/securityAudit';

export async function POST(req: Request) {
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

    const user = await getUserByToken(idToken);
    if (!user || user.role !== 'admin') {
      await logAuthFailure(req, decoded.email, 'Non-admin attempted admin login');
      return NextResponse.json({ detail: 'admin_access_required' }, { status: 403 });
    }

    await logAuthSuccess(req, user.id, user.email, 'password');
    return NextResponse.json({ token: idToken, user: mapUserToAuthUser(user) });
  } catch (error) {
    await logAuthFailure(req, null, error instanceof Error ? error.message : 'Token verification failed');
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Invalid credentials' }, { status: 401 });
  }
}
