import { NextResponse } from 'next/server';
import { getUserByToken, getCompanyById, listDocumentsForCompany } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

function toBand(score: number): 'tender-ready' | 'partially-ready' | 'high-risk' {
  if (score >= 85) return 'tender-ready';
  if (score >= 65) return 'partially-ready';
  return 'high-risk';
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
  if (!user || (user.role !== 'admin' && user.role !== 'evaluator')) {
    return NextResponse.json({ detail: 'Evaluator or admin only' }, { status: 403 });
  }

  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
  }

  const documents = await listDocumentsForCompany(companyId);
  const verifiedCount = documents.filter((doc) => doc.status === 'verified').length;
  const scoreValue = documents.length === 0 ? 0 : Math.round((verifiedCount / documents.length) * 100);

  const documentsByCategory = documents.reduce<Record<string, Array<{
    id: string;
    name: string;
    category: string;
    status: 'uploaded' | 'verified' | 'rejected' | 'expired';
    expiryDate: string | null;
    lastUpdated: string;
    uploadedBy: string;
    fileSize: string;
    fileType: string;
  }>>>((acc, doc) => {
    const entry = {
      id: doc.id,
      name: doc.name,
      category: doc.category,
      status: doc.status,
      expiryDate: doc.expiryDate,
      lastUpdated: doc.verifiedAt ?? doc.uploadedAt,
      uploadedBy: doc.verifiedBy ?? 'Company user',
      fileSize: formatFileSize(doc.fileSize),
      fileType: doc.mimeType ?? 'application/octet-stream',
    };

    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(entry);
    return acc;
  }, {});

  const auditLog = documents
    .flatMap((doc) => {
      const created = {
        id: `${doc.id}-uploaded`,
        actor: 'Company user',
        action: 'Document uploaded',
        entity: 'document',
        entityId: doc.id,
        timestamp: doc.uploadedAt,
        metadata: { name: doc.name, category: doc.category },
      };

      if (doc.status === 'verified' && doc.verifiedAt) {
        return [
          created,
          {
            id: `${doc.id}-verified`,
            actor: doc.verifiedBy ?? 'Admin',
            action: 'Document verified',
            entity: 'document',
            entityId: doc.id,
            timestamp: doc.verifiedAt,
            metadata: { name: doc.name },
          },
        ];
      }

      if (doc.status === 'rejected' && doc.verifiedAt) {
        return [
          created,
          {
            id: `${doc.id}-rejected`,
            actor: doc.verifiedBy ?? 'Admin',
            action: 'Document rejected',
            entity: 'document',
            entityId: doc.id,
            timestamp: doc.verifiedAt,
            metadata: { name: doc.name },
          },
        ];
      }

      return [created];
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 30);

  return NextResponse.json({
    company,
    score: {
      score: scoreValue,
      band: toBand(scoreValue),
      completedDocuments: verifiedCount,
      totalDocuments: documents.length,
      missingDocuments: [],
      expiringDocuments: documents
        .filter((doc) => doc.expiryDate)
        .map((doc) => `${doc.name} (${doc.expiryDate})`),
      lastCalculated: new Date().toISOString(),
    },
    documentsByCategory,
    auditLog,
    bundleUrl: `/api/verify/companies/${company.id}/bundle-url`,
  });
}
