import { NextResponse } from 'next/server';
import { listAllCompanies, listAllDocuments } from '@/lib/server/firestoreService';
import { requireAdmin } from '@/lib/server/apiAuth';

function extFromName(name: string) {
  const last = name.split('.').pop();
  return last ? last.toUpperCase() : 'FILE';
}

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const companies = await listAllCompanies();
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const items = (await listAllDocuments())
    .filter((doc) => doc.status === 'uploaded')
    .map((doc) => ({
      id: doc.id,
      name: doc.name,
      category: doc.category,
      status: doc.status,
      expiryDate: doc.expiryDate,
      lastUpdated: doc.uploadedAt,
      uploadedBy: 'Company User',
      fileSize: 'N/A',
      fileType: extFromName(doc.name),
      companyName: companyMap.get(doc.companyId)?.name ?? 'Unknown Company',
      companyId: doc.companyId,
    }));

  return NextResponse.json({ items });
}
