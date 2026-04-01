import { NextResponse } from 'next/server';
import { getUserByToken, mapUserToAuthUser, updateUserName } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(mapUserToAuthUser(user));
}

export async function PATCH(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const name = String(body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ detail: 'Name is required' }, { status: 400 });
  }

  const updated = await updateUserName(user.id, name);
  return NextResponse.json(updated);
}
