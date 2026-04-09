import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { setUserVerificationStatus } from '@/lib/server/firestoreService';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { userId } = await params;
  await setUserVerificationStatus(userId, 'rejected');
  return NextResponse.json({ ok: true });
}
