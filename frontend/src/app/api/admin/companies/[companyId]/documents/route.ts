import { NextResponse } from 'next/server';
import { listAllCompanies, listAllDocuments } from '@/lib/server/firestoreService';
import { requireAdmin } from '@/lib/server/apiAuth';

function extFromName(name: string) {
  const last = name.split('.').pop();
  return last ? last.toUpperCase() : 'FILE';
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { companyId } = await params;
  const companies = await listAllCompanies();
  const company = companies.find((c) => c.id === companyId);

  const items = (await listAllDocuments())
    .filter((doc) => doc.companyId === companyId)
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
      companyName: company?.name ?? 'Unknown Company',
      companyId,
    }));

  return NextResponse.json({ items });
}
