import { NextResponse } from 'next/server';
import { getCompanyById, listDocumentsForCompany } from '@/lib/server/firestoreService';
import { requireAdmin } from '@/lib/server/apiAuth';

function formatFileSize(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes)) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
  }

  const documents = await listDocumentsForCompany(companyId);
  const items = documents
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
      companyName: company.name,
      companyId: company.id,
    }));

  return NextResponse.json({ items });
}
