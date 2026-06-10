import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/apiAuth';
import { listNotificationsForUser } from '@/lib/server/firestoreService';

export async function GET(req: Request) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const params = new URL(req.url).searchParams;
  const unreadOnly = params.get('unread_only') === 'true';
  const limit = Math.min(100, Math.max(1, Number(params.get('limit') ?? 20)));
  const items = await listNotificationsForUser(user!.id, unreadOnly, limit);
  return NextResponse.json(items);
}
