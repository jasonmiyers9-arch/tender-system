import { NextResponse } from 'next/server';
import { getUserByToken, listCompaniesForUser, listDocumentsForCompany } from '@/lib/server/firestoreService';
import type { RenewalBucket } from '@/lib/api/types';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

function getBucket(daysUntilExpiry: number): RenewalBucket {
  if (daysUntilExpiry <= 0) return 'expired';
  if (daysUntilExpiry <= 7) return 'due-7';
  if (daysUntilExpiry <= 30) return 'due-30';
  if (daysUntilExpiry <= 60) return 'due-60';
  return 'due-90';
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
    const renewals: Array<{
      id: string;
      companyName: string;
      companyId: string;
      documentName: string;
      daysUntilExpiry: number;
      expiryDate: string;
      bucket: RenewalBucket;
    }> = [];

    const now = Date.now();

    for (const company of companies) {
      const docs = await listDocumentsForCompany(company.id);
      for (const doc of docs) {
        if (!doc.expiryDate) continue;
        const expiryMs = new Date(doc.expiryDate).getTime();
        const daysUntilExpiry = Math.ceil((expiryMs - now) / (1000 * 60 * 60 * 24));

        renewals.push({
          id: doc.id,
          companyName: company.name,
          companyId: company.id,
          documentName: doc.name,
          daysUntilExpiry,
          expiryDate: doc.expiryDate,
          bucket: getBucket(daysUntilExpiry),
        });
      }
    }

    renewals.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return NextResponse.json(renewals);
  } catch (error) {
    console.error('GET /api/admin/dashboard/renewals error:', error);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
