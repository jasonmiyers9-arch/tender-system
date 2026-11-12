import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/server/firebaseAdmin';
import { getOrCreateGoogleUser, getUserByEmail, mapUserToAuthUser } from '@/lib/server/firestoreService';
import { isAdminRole } from '@/lib/server/apiAuth';
import { accountAccessDetail } from '@/lib/server/accountPolicy';

export async function POST(req: Request) {
  const body = await req.json();
  const idToken = String(body.idToken ?? '').trim();

  if (!idToken) {
    return NextResponse.json({ detail: 'Google ID token is required' }, { status: 400 });
  }

  try {
    const decoded = await verifyIdToken(idToken);
    if (!decoded.email) {
      return NextResponse.json({ detail: 'Google account email is required' }, { status: 400 });
    }

    const existing = await getUserByEmail(decoded.email);
    if (isAdminRole(existing?.role)) {
      return NextResponse.json({ detail: 'admin_portal_required' }, { status: 403 });
    }

    const user = await getOrCreateGoogleUser({
      uid: decoded.uid,
      email: decoded.email,
      fullName: decoded.name ?? decoded.email.split('@')[0],
    });

    const accessDetail = accountAccessDetail(user);
    if (accessDetail) {
      return NextResponse.json({ detail: accessDetail }, { status: 403 });
    }

    return NextResponse.json({ token: idToken, user: mapUserToAuthUser(user) });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Google sign-in failed' },
      { status: 401 }
    );
  }
}
