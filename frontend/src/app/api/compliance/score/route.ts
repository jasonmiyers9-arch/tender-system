import { NextResponse } from 'next/server';
import { 
  getUserByToken, 
  listCompaniesForUser, 
  listDocumentsForCompany,
  getTenderById 
} from '@/lib/server/firestoreService';
import {
  generateComplianceProfile,
  calculateTenderMatchScore,
  type TenderRequirements
} from '@/lib/server/complianceScoring';
import {
  applyHybridScoreAdjustment,
  buildTenderRequirementsFromTender,
  persistAnalystRun,
} from '@/lib/server/analystEngine';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

/**
 * GET /api/compliance/score
 * Get company compliance profile and overall score
 */
export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await getUserByToken(token);
    if (!user) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    let activeCompanyId = user.activeCompanyId;
    if (!activeCompanyId) {
      const companies = await listCompaniesForUser(user.id);
      activeCompanyId = companies[0]?.id;
    }

    if (!activeCompanyId) {
      return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
    }

    // Get all company documents
    const documents = await listDocumentsForCompany(activeCompanyId);
    
    // Generate compliance profile
    const profile = generateComplianceProfile(activeCompanyId, documents);

    return NextResponse.json({
      companyId: activeCompanyId,
      overallScore: profile.overallScore,
      categoryScores: profile.categoryScores,
      missingCategories: profile.missingCategories,
      expiringDocuments: profile.expiringDocuments,
      recommendations: profile.recommendations,
      documentCount: documents.length,
      lastCalculated: profile.lastCalculated,
    });
  } catch (error) {
    console.error('GET /api/compliance/score error:', error);
    return NextResponse.json({ detail: 'Failed to calculate compliance score' }, { status: 500 });
  }
}

/**
 * POST /api/compliance/score
 * Calculate tender-specific match score
 */
export async function POST(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await getUserByToken(token);
    if (!user) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    let activeCompanyId = user.activeCompanyId;
    if (!activeCompanyId) {
      const companies = await listCompaniesForUser(user.id);
      activeCompanyId = companies[0]?.id;
    }

    if (!activeCompanyId) {
      return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
    }

    const body = await req.json();
    const { tenderId } = body;

    if (!tenderId) {
      return NextResponse.json({ detail: 'tenderId is required' }, { status: 400 });
    }

    // Get tender details
    const tender = await getTenderById(tenderId);
    if (!tender) {
      return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
    }

    // Get company documents
    const documents = await listDocumentsForCompany(activeCompanyId);
    
    // Generate compliance profile
    const profile = generateComplianceProfile(activeCompanyId, documents);

    // Build normalized tender requirements for deterministic + hybrid scoring.
    const requirements: TenderRequirements = buildTenderRequirementsFromTender(tender);

    // Calculate deterministic tender match score first.
    const deterministic = calculateTenderMatchScore(
      activeCompanyId,
      tenderId,
      tender.title,
      profile,
      requirements
    );

    const hybrid = await applyHybridScoreAdjustment({
      deterministic,
      profile,
      requirements,
      tenderContext: {
        id: tender.id,
        title: tender.title,
        description: tender.description,
        requirements: tender.requirements,
        eligibilityCriteria: tender.eligibilityCriteria,
      },
    });

    await persistAnalystRun({
      companyId: activeCompanyId,
      tenderId,
      tenderTitle: tender.title,
      trigger: 'api.compliance.score.requested',
      actorUserId: user.id,
      result: deterministic,
      hybrid,
      profile,
    });

    return NextResponse.json({
      tenderId,
      tenderTitle: tender.title,
      companyId: activeCompanyId,
      matchScore: hybrid.adjustedScore,
      deterministicScore: deterministic.matchScore,
      llmDeltaApplied: hybrid.llmDeltaApplied,
      isEligible: deterministic.isEligible,
      breakdown: deterministic.breakdown,
      gaps: deterministic.gaps,
      recommendations: deterministic.recommendations,
      missingDocuments: deterministic.missingDocuments,
      strengths: deterministic.strengths,
      recommendation: hybrid.analystSummary || deterministic.recommendation,
      confidenceScore: hybrid.confidenceScore,
      priorityActions: deterministic.priorityActions,
      hybrid: {
        source: hybrid.source,
        reasonCodes: hybrid.reasonCodes,
        model: hybrid.model,
        promptVersion: hybrid.promptVersion,
      },
      companyProfile: {
        overallScore: profile.overallScore,
        documentCount: documents.length,
        missingCategories: profile.missingCategories,
      },
      calculatedAt: deterministic.calculatedAt,
    });
  } catch (error) {
    console.error('POST /api/compliance/score error:', error);
    return NextResponse.json({ detail: 'Failed to calculate tender match score' }, { status: 500 });
  }
}
