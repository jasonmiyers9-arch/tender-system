import { NextResponse } from 'next/server';
import { getDocumentById, verifyDocument, getUserByToken } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { documentId } = await params;
  const document = await getDocumentById(documentId);
  if (!document) {
    return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json(document);
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
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Admin only' }, { status: 403 });
  }

  const { documentId } = await params;
  const body = await req.json();
  const action = String(body.action ?? '').trim();

  if (action === 'verify') {
    const updated = await verifyDocument(documentId, user.id);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ detail: 'Unknown action' }, { status: 400 });
}
