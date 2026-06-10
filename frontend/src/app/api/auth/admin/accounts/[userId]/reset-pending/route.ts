import { NextResponse } from 'next/server';
import { isAdminRole, requireAdmin } from '@/lib/server/apiAuth';
import { getUserDocumentById, setUserVerificationStatus } from '@/lib/server/firestoreService';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { userId } = await params;
  const target = await getUserDocumentById(userId);
  if (!target) {
    return NextResponse.json({ detail: 'User not found' }, { status: 404 });
  }
  if (isAdminRole(target.role)) {
    return NextResponse.json({ detail: 'Internal admin accounts are managed separately' }, { status: 400 });
  }

  await setUserVerificationStatus(userId, 'pending');
  return NextResponse.json({ ok: true });
}
