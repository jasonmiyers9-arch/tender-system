import { NextResponse } from 'next/server';
import { getUserByToken, verifyDocument } from '@/lib/server/firestoreService';
import { publishRescoreEvent } from '@/lib/server/analystEngine';
import { isAdminRole } from '@/lib/server/apiAuth';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ detail: 'Admin only' }, { status: 403 });
  }

  const { documentId } = await params;
  const document = await verifyDocument(documentId, user.id);
  await publishRescoreEvent({
    eventType: 'document.verified',
    companyId: document.companyId,
    actorUserId: user.id,
    metadata: { documentId: document.id, status: document.status },
  });
  return NextResponse.json({ ok: true });
}
