import { NextResponse } from 'next/server';
import { getUserByToken, getCompanyById, listDocumentsForCompany } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

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
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Admin only' }, { status: 403 });
  }

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
