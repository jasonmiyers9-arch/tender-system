import { NextResponse } from 'next/server';
import { getUserByToken, getCompanyById, listDocumentsForCompany } from '@/lib/server/firestoreService';
import { 
  calculateTenderReadinessScore, 
  type CompanyProfileFields 
} from '@/lib/server/complianceScoring';
import { 
  getExpiredInPast12Months, 
  isNewAccount 
} from '@/lib/server/expiryCheckService';
import { extractRequestContext, logSecurityEvent, SecurityEventType } from '@/lib/server/securityAudit';
import { isAdminRole } from '@/lib/server/apiAuth';

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

const authorityByCategory: Record<string, string> = {
  tax: 'SARS',
  tax_clearance: 'SARS',
  sars_pin: 'SARS',
  registration: 'CIPC',
  cipc_registration: 'CIPC',
  bbbee: 'SANAS / B-BBEE Commission',
  bbbee_certificate: 'SANAS / B-BBEE Commission',
  csd_registration: 'National Treasury CSD',
  cidb: 'CIDB',
  cidb_certificate: 'CIDB',
  coida: 'Department of Employment and Labour',
  uif: 'UIF',
  certification: 'Issuing Authority',
  financial: 'Registered Accountant',
  legal: 'Legal Authority',
  policy: 'Company Policy',
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || (!isAdminRole(user.role) && user.role !== 'evaluator')) {
    return NextResponse.json({ detail: 'Evaluator or admin only' }, { status: 403 });
  }

  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
  }

  await logSecurityEvent({
    type: SecurityEventType.DATA_ACCESS,
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    companyId,
    outcome: 'success',
    resourceType: 'company_compliance_report',
    resourceId: companyId,
    ...extractRequestContext(req),
    details: {
      action: 'evaluator_verification_report_view',
      companyName: company.name,
      companyRegistrationNumber: company.registrationNumber,
      companyCsdNumber: company.csdNumber ?? null,
      viewedBy: user.email,
      verificationTimestamp: new Date().toISOString(),
    },
  });

  const documents = await listDocumentsForCompany(companyId);
  
  // Build company profile for CSD completeness scoring
  const companyProfile: CompanyProfileFields = {
    name: company.name,
    registrationNumber: company.registrationNumber,
    vatNumber: company.vatNumber,
    industry: company.industry,
    province: company.province ?? undefined,
    address: company.address,
    contactEmail: company.email,
    contactPhone: company.phone,
  };
  
  // Get compliance consistency data
  const expiredInPast12Months = await getExpiredInPast12Months(companyId);
  const isNewAccountFlag = await isNewAccount(companyId);
  
  // Calculate new Tender Readiness Score™
  const readinessScore = calculateTenderReadinessScore(
    companyId,
    documents,
    companyProfile,
    company.industry,
    expiredInPast12Months,
    isNewAccountFlag
  );
  
  // Legacy score calculation for backward compatibility
  const verifiedCount = documents.filter((doc) => doc.status === 'verified').length;

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
    issuingAuthority: string;
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
      issuingAuthority: authorityByCategory[doc.category] ?? 'Issuing Authority',
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
      score: readinessScore.totalScore,
      band: toBand(readinessScore.totalScore),
      completedDocuments: verifiedCount,
      totalDocuments: documents.length,
      missingDocuments: readinessScore.missingForBidReady,
      expiringDocuments: documents
        .filter((doc) => doc.expiryDate)
        .map((doc) => `${doc.name} (${doc.expiryDate})`),
      lastCalculated: readinessScore.calculatedAt,
      isBidReady: readinessScore.isBidReady,
    },
    // New Tender Readiness Score™ breakdown
    readinessScore: {
      totalScore: readinessScore.totalScore,
      dimensions: readinessScore.dimensions,
      breakdown: readinessScore.breakdown,
      isBidReady: readinessScore.isBidReady,
      missingForBidReady: readinessScore.missingForBidReady,
    },
    documentsByCategory,
    auditLog,
    bundleUrl: `/api/verify/companies/${company.id}/bundle-url`,
    verification: {
      isVerified: company.status === 'verified',
      lastVerifiedAt: documents
        .map((doc) => doc.verifiedAt)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null,
      generatedAt: new Date().toISOString(),
    },
  });
}
