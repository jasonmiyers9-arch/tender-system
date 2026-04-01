import { NextResponse } from 'next/server';
import { getDocumentById, getUserByToken, listCompaniesForUser, renewDocument } from '../../../../../lib/server/firestoreService';

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

  try {
    const user = await getUserByToken(token);
    if (!user) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    let activeCompanyId = user.activeCompanyId;
    if (!activeCompanyId) {
      const companies = await listCompaniesForUser(user.id);
      activeCompanyId = companies[0]?.id;
    }

    if (!activeCompanyId) {
      return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
    }

    const { documentId } = await params;
    const document = await getDocumentById(documentId);
    if (!document || document.companyId !== activeCompanyId) {
      return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
    }

    const body = await req.json();
    const expiryDate = body.expiry_date ? String(body.expiry_date) : null;
    const updated = await renewDocument(documentId, expiryDate);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/documents/[documentId]/renew error:', error);
    return NextResponse.json({ detail: 'Failed to renew document' }, { status: 500 });
  }
}
