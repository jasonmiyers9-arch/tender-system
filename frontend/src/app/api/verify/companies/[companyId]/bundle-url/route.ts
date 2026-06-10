import { NextResponse } from 'next/server';
import { getUserByToken, getCompanyById, listDocumentsForCompany } from '@/lib/server/firestoreService';
import { calculateTenderReadinessScore, type CompanyProfileFields } from '@/lib/server/complianceScoring';
import { getExpiredInPast12Months, isNewAccount } from '@/lib/server/expiryCheckService';
import { generateComplianceBundlePdf } from '@/lib/server/complianceBundlePdf';
import { tryGenerateComplianceBundleWithWeasyPrint } from '@/lib/server/weasyprintPdf';
import { extractRequestContext, logSecurityEvent, SecurityEventType } from '@/lib/server/securityAudit';
import { isAdminRole } from '@/lib/server/apiAuth';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
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
  if (!user || (!isAdminRole(user.role) && user.role !== 'evaluator')) {
    return NextResponse.json({ detail: 'Evaluator or admin only' }, { status: 403 });
  }

  const { companyId } = await params;
  const acceptsJson = req.headers.get('accept')?.includes('application/json');
  if (acceptsJson) {
    return NextResponse.json({ url: `/api/verify/companies/${companyId}/bundle-url` });
  }

  const company = await getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
  }

  const ctx = extractRequestContext(req);
  await logSecurityEvent({
    type: SecurityEventType.DATA_EXPORT,
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    companyId,
    outcome: 'success',
    resourceType: 'compliance_bundle_pdf',
    resourceId: companyId,
    ...ctx,
    details: {
      action: 'evaluator_compliance_bundle_pdf_download',
      companyName: company.name,
      companyRegistrationNumber: company.registrationNumber,
      companyCsdNumber: company.csdNumber ?? null,
      downloadedBy: user.email,
      verificationTimestamp: new Date().toISOString(),
    },
  });

  const documents = await listDocumentsForCompany(companyId);
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
  const [expiredInPast12Months, newAccount] = await Promise.all([
    getExpiredInPast12Months(companyId),
    isNewAccount(companyId),
  ]);
  const readinessScore = calculateTenderReadinessScore(
    companyId,
    documents,
    companyProfile,
    company.industry,
    expiredInPast12Months,
    newAccount,
  );
  const verifiedCount = documents.filter((doc) => doc.status === 'verified').length;
  const generatedAt = new Date().toISOString();
  const pdfInput = {
    company,
    score: {
      score: readinessScore.totalScore,
      band: readinessScore.totalScore >= 85 ? 'tender-ready' : readinessScore.totalScore >= 65 ? 'partially-ready' : 'high-risk',
      completedDocuments: verifiedCount,
      totalDocuments: documents.length,
      missingDocuments: readinessScore.missingForBidReady,
      lastCalculated: readinessScore.calculatedAt,
    },
    readinessScore: {
      dimensions: readinessScore.dimensions,
      missingForBidReady: readinessScore.missingForBidReady,
    },
    documents: documents.map((doc) => ({
      name: doc.name,
      category: doc.category,
      status: doc.status,
      expiryDate: doc.expiryDate,
      lastUpdated: doc.verifiedAt ?? doc.uploadedAt,
    })),
    auditLog: documents
      .flatMap((doc) => [
        {
          actor: 'Company user',
          action: 'Document uploaded',
          timestamp: doc.uploadedAt,
        },
        ...(doc.verifiedAt
          ? [{
              actor: doc.verifiedBy ?? 'Admin',
              action: doc.status === 'rejected' ? 'Document rejected' : 'Document verified',
              timestamp: doc.verifiedAt,
            }]
          : []),
      ])
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    generatedAt,
  };
  const weasyPrintPdf = await tryGenerateComplianceBundleWithWeasyPrint(pdfInput);
  const pdf = weasyPrintPdf ?? generateComplianceBundlePdf(pdfInput);

  const filename = `${company.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'company'}-tenderguard-compliance-bundle.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-TenderGuard-Seal': 'Verified by TenderGuard',
      'X-PDF-Engine': weasyPrintPdf ? 'weasyprint' : 'built-in-fallback',
    },
  });
}
