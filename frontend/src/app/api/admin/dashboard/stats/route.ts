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

    let totalDocuments = 0;
    let pendingVerification = 0;
    let tenderReady = 0;
    let partiallyReady = 0;
    let highRisk = 0;

    for (const company of companies) {
      const docs = await listDocumentsForCompany(company.id);
      totalDocuments += docs.length;
      pendingVerification += docs.filter((d) => d.status === 'uploaded').length;

      const verifiedCount = docs.filter((d) => d.status === 'verified').length;
      const expiredCount = docs.filter((d) => d.status === 'expired').length;

      if (docs.length > 0 && verifiedCount === docs.length) {
        tenderReady++;
      } else if (expiredCount > 0 || docs.length === 0) {
        highRisk++;
      } else {
        partiallyReady++;
      }
    }

    return NextResponse.json({
      totalCompanies: companies.length,
      tenderReady,
      partiallyReady,
      highRisk,
      totalDocuments,
      pendingVerification,
    });
  } catch (error) {
    console.error('GET /api/admin/dashboard/stats error:', error);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
