import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/apiAuth';
import { markNotificationRead } from '@/lib/server/firestoreService';

export async function POST(req: Request, context: { params: Promise<{ notificationId: string }> }) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const { notificationId } = await context.params;
  const ok = await markNotificationRead(notificationId, user!.id);
  if (!ok) {
    return NextResponse.json({ detail: 'Notification not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
