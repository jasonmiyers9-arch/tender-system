import { NextResponse } from 'next/server';
import { getDocumentById, getUserByToken, renewDocument } from '../../../../../lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || !user.activeCompanyId) {
    return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
  }

  const { documentId } = await params;
  const document = await getDocumentById(documentId);
  if (!document || document.companyId !== user.activeCompanyId) {
    return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
  }

  const body = await req.json();
  const expiryDate = body.expiry_date ? String(body.expiry_date) : null;
  const updated = await renewDocument(documentId, expiryDate);
  return NextResponse.json(updated);
}
