import { NextResponse } from 'next/server';
import { listAllCompanies, listAllDocuments } from '@/lib/server/firestoreService';
import { requireAdmin } from '@/lib/server/apiAuth';

function formatFileSize(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes)) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const [documents, companies] = await Promise.all([listAllDocuments(), listAllCompanies()]);
  const companyNameById = new Map(companies.map((company) => [company.id, company.name]));

  const items = documents
    .filter((doc) => doc.status === 'uploaded')
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .map((doc) => ({
      id: doc.id,
      name: doc.name,
      category: doc.category,
      status: doc.status,
      expiryDate: doc.expiryDate,
      lastUpdated: doc.verifiedAt ?? doc.uploadedAt,
      uploadedBy: doc.verifiedBy ?? 'Company user',
      fileSize: formatFileSize(doc.fileSize),
      fileType: doc.mimeType ?? 'application/octet-stream',
      companyName: companyNameById.get(doc.companyId) ?? 'Unknown Company',
      companyId: doc.companyId,
    }));

  return NextResponse.json({ items });
}
