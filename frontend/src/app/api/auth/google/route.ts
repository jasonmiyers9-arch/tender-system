import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/server/firebaseAdmin';
import { getOrCreateGoogleUser, getUserByEmail, mapUserToAuthUser } from '@/lib/server/firestoreService';

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
    if (existing?.role === 'admin') {
      return NextResponse.json({ detail: 'admin_portal_required' }, { status: 403 });
    }

    const user = await getOrCreateGoogleUser({
      uid: decoded.uid,
      email: decoded.email,
      fullName: decoded.name ?? decoded.email.split('@')[0],
    });

    return NextResponse.json({ token: idToken, user: mapUserToAuthUser(user) });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Google sign-in failed' },
      { status: 401 }
    );
  }
}
