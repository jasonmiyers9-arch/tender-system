import { NextResponse } from 'next/server';
import { getCompanyById, getUserByToken, listCompaniesForUser, listDocumentsForCompany } from '@/lib/server/firestoreService';
import { calculateTenderReadinessScore, type CompanyProfileFields } from '@/lib/server/complianceScoring';
import { getExpiredInPast12Months, isNewAccount } from '@/lib/server/expiryCheckService';
import { buildComplianceScore } from '@/lib/utils/calculateReadinessScore';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : null;
}

function bandForScore(score: number): 'tender-ready' | 'partially-ready' | 'high-risk' {
  return score >= 85 ? 'tender-ready' : score >= 65 ? 'partially-ready' : 'high-risk';
}

function companyProfileFields(company: Awaited<ReturnType<typeof getCompanyById>> | null): CompanyProfileFields {
  return {
    name: company?.name,
    registrationNumber: company?.registrationNumber,
    vatNumber: company?.vatNumber,
    industry: company?.industry,
    province: company?.province ?? undefined,
    address: company?.address,
    contactEmail: company?.email,
    contactPhone: company?.phone,
    bbbeeLevel: company?.bbbeeLevel ? Number(String(company.bbbeeLevel).replace(/[^0-9]/g, '')) || undefined : undefined,
    cidbGrade: company?.cidbGrade ?? undefined,
  };
}

function emptyScore() {
  return {
    ...buildComplianceScore([]),
    scoreBreakdown: {
      documentCompleteness: 0,
      verificationCoverage: 0,
      csdProfileCompleteness: 0,
      complianceConsistency: 10,
      tenderFitBonus: 10,
    },
  };
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await getUserByToken(token);
    if (!user) {
      return NextResponse.json(emptyScore(), { status: 200 });
    }

    let activeCompanyId = user.activeCompanyId;
    if (!activeCompanyId) {
      const companies = await listCompaniesForUser(user.id);
      activeCompanyId = companies[0]?.id ?? null;
    }

    if (!activeCompanyId) {
      return NextResponse.json(emptyScore(), { status: 200 });
    }

    const [company, documents, expiredInPast12Months, newAccount] = await Promise.all([
      getCompanyById(activeCompanyId),
      listDocumentsForCompany(activeCompanyId),
      getExpiredInPast12Months(activeCompanyId),
      isNewAccount(activeCompanyId),
    ]);

    const baseScore = buildComplianceScore(documents);
    const readinessScore = calculateTenderReadinessScore(
      activeCompanyId,
      documents,
      companyProfileFields(company),
      company?.industry,
      expiredInPast12Months,
      newAccount
    );

    return NextResponse.json({
      ...baseScore,
      score: readinessScore.totalScore,
      band: bandForScore(readinessScore.totalScore),
      scoreBreakdown: readinessScore.dimensions,
      lastCalculated: readinessScore.calculatedAt,
    });
  } catch (error) {
    console.error('GET /api/score/current error:', error);
    return NextResponse.json(emptyScore(), { status: 200 });
  }
}