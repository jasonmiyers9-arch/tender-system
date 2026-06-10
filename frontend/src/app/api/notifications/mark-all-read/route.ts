import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/apiAuth';
import { markAllNotificationsRead } from '@/lib/server/firestoreService';

export async function POST(req: Request) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const count = await markAllNotificationsRead(user!.id);
  return NextResponse.json({ ok: true, count });
}
