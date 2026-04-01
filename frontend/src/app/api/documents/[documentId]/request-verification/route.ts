import { NextResponse } from 'next/server';
import { getDocumentById, getUserByToken, listCompaniesForUser } from '../../../../../lib/server/firestoreService';

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

    return NextResponse.json({ ok: true, status: 'verification_requested' });
  } catch (error) {
    console.error('POST /api/documents/[documentId]/request-verification error:', error);
    return NextResponse.json({ detail: 'Failed to request verification' }, { status: 500 });
  }
}
