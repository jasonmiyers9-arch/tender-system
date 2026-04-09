import { NextResponse } from 'next/server';
import { ensureFirebaseUser, getUserByToken, mapUserToAuthUser } from '@/lib/server/firestoreService';
import { verifyIdToken } from '@/lib/server/firebaseAdmin';

export async function POST(req: Request) {
  const body = await req.json();
  const idToken = String(body.idToken ?? '').trim();

  if (!idToken) {
    return NextResponse.json({ detail: 'Firebase ID token is required' }, { status: 400 });
  }

  try {
    const decoded = await verifyIdToken(idToken);
    if (!decoded.email) {
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
      return NextResponse.json({ detail: 'Unable to load user profile' }, { status: 500 });
    }

    return NextResponse.json({ token: idToken, user: mapUserToAuthUser(user) });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Invalid credentials' }, { status: 401 });
  }
}
