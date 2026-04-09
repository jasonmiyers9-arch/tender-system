import { NextResponse } from 'next/server';
import { getUserByToken } from './firestoreService';

export function parseBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : null;
}

export async function requireAdmin(req: Request) {
  const token = parseBearerToken(req);
  if (!token) {
    return { user: null, error: NextResponse.json({ detail: 'Unauthorized' }, { status: 401 }) };
  }

  const user = await getUserByToken(token);
  if (!user) {
    return { user: null, error: NextResponse.json({ detail: 'Unauthorized' }, { status: 401 }) };
  }

  if (user.role !== 'admin') {
    return { user: null, error: NextResponse.json({ detail: 'Admin only' }, { status: 403 }) };
  }

  return { user, error: null };
}
