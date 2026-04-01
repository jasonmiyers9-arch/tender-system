import { NextResponse } from 'next/server';
import { authenticateUser, mapUserToAuthUser } from '@/lib/server/firestoreService';

export async function POST(req: Request) {
  const body = await req.json();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!email || !password) {
    return NextResponse.json({ detail: 'Email and password are required' }, { status: 400 });
  }

  const user = await authenticateUser(email, password);
  if (!user) {
    return NextResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
  }

  return NextResponse.json({ token: user.id, user: mapUserToAuthUser(user) });
}
