import { NextResponse } from 'next/server';
import { getUserByToken, listAllCompanies, listDocumentsForCompany } from '@/lib/server/firestoreService';
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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || (!isAdminRole(user.role) && user.role !== 'evaluator')) {
    return NextResponse.json({ detail: 'Evaluator or admin only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = normalize(url.searchParams.get('q') ?? '');

  const companies = await listAllCompanies();
  const filtered = !q
    ? companies
    : companies.filter((company) => {
        const hayName = normalize(company.name);
        const hayReg = normalize(company.registrationNumber ?? '');
        const hayCsd = normalize(company.csdNumber ?? '');
        return hayName.includes(q) || hayReg.includes(q) || hayCsd.includes(q);
      });

  const items = await Promise.all(
    filtered.map(async (company) => {
      const docs = await listDocumentsForCompany(company.id);
      
      // Build company profile for scoring
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
      const expiredCount = await getExpiredInPast12Months(company.id);
      const isNew = await isNewAccount(company.id);
      
      // Calculate new Tender Readiness Score™
      const readinessScore = calculateTenderReadinessScore(
        company.id,
        docs,
        companyProfile,
        company.industry,
        expiredCount,
        isNew
      );
      
      const lastUpdated = docs
        .map((doc) => doc.verifiedAt ?? doc.uploadedAt)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? new Date().toISOString();

      return {
        id: company.id,
        name: company.name,
        registrationNumber: company.registrationNumber,
        csdNumber: company.csdNumber,
        industry: company.industry,
        province: company.province,
        score: readinessScore.totalScore,
        band: toBand(readinessScore.totalScore),
        isBidReady: readinessScore.isBidReady,
        lastUpdated,
      };
    })
  );

  items.sort((a, b) => b.score - a.score);

  await logSecurityEvent({
    type: SecurityEventType.DATA_ACCESS,
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    outcome: 'success',
    resourceType: 'company',
    resourceId: q || 'all',
    ...extractRequestContext(req),
    details: {
      action: 'evaluator_company_search',
      query: q,
      resultCount: items.length,
      matchedCompanyIds: items.map((item) => item.id),
    },
  });

  return NextResponse.json(items);
}
