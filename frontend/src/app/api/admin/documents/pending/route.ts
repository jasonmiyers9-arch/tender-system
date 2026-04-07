import { NextResponse } from 'next/server';
import { getUserByToken, listCompaniesForUser, listDocumentsForCompany } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await getUserByToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
    }

    const companies = await listCompaniesForUser(user.id);
    const pendingDocs: Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      expiryDate: string | null;
      lastUpdated: string;
      uploadedBy: string;
      fileSize: string;
      fileType: string;
      companyName: string;
      companyId: string;
    }> = [];

    for (const company of companies) {
      const docs = await listDocumentsForCompany(company.id);
      for (const doc of docs) {
        if (doc.status !== 'uploaded') continue;
        pendingDocs.push({
          id: doc.id,
          name: doc.name,
          category: doc.category,
          status: doc.status,
          expiryDate: doc.expiryDate,
          lastUpdated: doc.uploadedAt,
          uploadedBy: '',
          fileSize: '',
          fileType: 'application/pdf',
          companyName: company.name,
          companyId: company.id,
        });
      }
    }

    return NextResponse.json({ items: pendingDocs });
  } catch (error) {
    console.error('GET /api/admin/documents/pending error:', error);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
