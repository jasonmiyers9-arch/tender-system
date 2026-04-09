import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { setDocumentStatus } from '@/lib/server/firestoreService';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { user, error } = await requireAdmin(req);
  if (error || !user) return error;

  const { docId } = await params;
  await setDocumentStatus(docId, 'verified', user.id);
  return NextResponse.json({ ok: true });
}
