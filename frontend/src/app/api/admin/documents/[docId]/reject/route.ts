import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { setDocumentStatus } from '@/lib/server/firestoreService';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { docId } = await params;
  await setDocumentStatus(docId, 'rejected');
  return NextResponse.json({ ok: true });
}
