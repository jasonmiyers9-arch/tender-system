import { NextResponse } from 'next/server';
import { listAllCompanies, listAllDocuments } from '@/lib/server/firestoreService';
import { requireAdmin } from '@/lib/server/apiAuth';

function bucketFor(days: number): 'due-90' | 'due-60' | 'due-30' | 'due-7' | 'expired' {
  if (days < 0) return 'expired';
  if (days <= 7) return 'due-7';
  if (days <= 30) return 'due-30';
  if (days <= 60) return 'due-60';
  return 'due-90';
}

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const companies = await listAllCompanies();
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const docs = await listAllDocuments();
  const today = new Date();

  const items = docs
    .filter((doc) => !!doc.expiryDate)
    .map((doc) => {
      const expiry = new Date(String(doc.expiryDate));
      const diffMs = expiry.getTime() - today.getTime();
      const daysUntilExpiry = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const company = companyMap.get(doc.companyId);

      return {
        id: doc.id,
        companyName: company?.name ?? 'Unknown Company',
        companyId: doc.companyId,
        documentName: doc.name,
        daysUntilExpiry,
        expiryDate: String(doc.expiryDate),
        bucket: bucketFor(daysUntilExpiry),
      };
    })
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    .slice(0, 300);

  return NextResponse.json(items);
}
