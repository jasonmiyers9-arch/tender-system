import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getTenderReadiness, getUserByToken, listDocumentsForCompany, getCompanyById } from '@/lib/server/firestoreService';
import { requireAuth, parseBearerToken } from '@/lib/server/apiAuth';
import { getScrapedTenders, type ScrapedTender } from '@/lib/server/tenderScraper';
import { calculateTenderMatchScore, generateComplianceProfile, type TenderRequirements } from '@/lib/server/complianceScoring';
import { normalizeTenderCategory } from '@/lib/server/tenderCategories';

function scrapedTenderId(tender: ScrapedTender): string {
  const raw = `${tender.sourceSite}|${tender.tenderNumber || tender.referenceNumber || tender.title}|${tender.deadline}`;
  return `scraped-${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
}

function normalizeCategory(value: string): string {
  const normalized = normalizeTenderCategory(value);
  return normalized === 'Other' ? value.trim().toLowerCase() : normalized.toLowerCase();
}

function categoryMatches(tenderCategory: string, companyCategories: string[], tenderText = ''): boolean {
  if (companyCategories.length === 0) return true;
  const tender = normalizeCategory(tenderCategory);
  const haystack = `${tenderCategory} ${tenderText}`.toLowerCase();
  return companyCategories.some((category) => {
    const selected = normalizeCategory(category);
    const rawSelected = category.toLowerCase();
    return tender === selected || tender.includes(selected) || selected.includes(tender) || haystack.includes(rawSelected) || haystack.includes(selected);
  });
}

function inferRequiredCategoriesFromScrapedTender(tender: ScrapedTender): TenderRequirements {
  const text = [
    tender.category,
    tender.rawCategory,
    tender.title,
    tender.description,
    tender.specialConditions,
    tender.fullText,
    ...(tender.requirements ?? []),
    ...(tender.eligibilityCriteria ?? []),
  ].join(' ').toLowerCase();
  const required = new Set<string>(['tax', 'registration']);
  const preferred = new Set<string>();

  if (/\bbbbee\b|\bb-bbee\b|\bbee\b|sworn affidavit/.test(text)) required.add('bbbee');
  if (/\bcsd\b|central supplier database|supplier number/.test(text)) required.add('registration');
  if (/\bcidb\b|construction|civil works|engineering/.test(text)) required.add('certification');
  if (/financial statement|annual financial|bank statement|bank confirmation|turnover/.test(text)) required.add('financial');
  if (/insurance|public liability|professional indemnity|letter of good standing|coida|safety file/.test(text)) required.add('legal');
  if (/iso|quality management|environmental|health and safety|ohs/.test(text)) preferred.add('certification');

  return {
    requiredCategories: [...required],
    preferredCategories: [...preferred],
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const { error } = await requireAuth(req);
  if (error) return error;

  const { tenderId } = await params;
  
  // Get company context from authenticated user
  const token = parseBearerToken(req);
  let companyId: string | undefined;
  
  if (token) {
    const user = await getUserByToken(token);
    if (user?.activeCompanyId) {
      companyId = user.activeCompanyId;
    }
  }
  
  const readiness = await getTenderReadiness(tenderId, companyId);
  if (!readiness) {
    const scraped = (await getScrapedTenders()).find((item) => scrapedTenderId(item) === tenderId);
    if (scraped && companyId) {
      const documents = await listDocumentsForCompany(companyId);
      const profile = generateComplianceProfile(companyId, documents);
      const score = calculateTenderMatchScore(
        companyId,
        tenderId,
        scraped.title,
        profile,
        inferRequiredCategoriesFromScrapedTender(scraped),
      );
      const company = await getCompanyById(companyId);
      const categoryHit = categoryMatches(scraped.category, company?.tenderCategories ?? [], scraped.fullText || scraped.description || scraped.title);
      const readinessScore = Math.min(100, score.matchScore + (categoryHit ? 10 : 0));
      return NextResponse.json({
        tenderId,
        readyToSubmit: score.isEligible,
        readinessScore,
        isBidReady: score.isEligible && readinessScore >= 75,
        blockers: score.gaps.map((gap) => gap.recommendation),
        missingCategories: score.missingDocuments,
        gaps: score.gaps.map((gap) => gap.recommendation),
        recommendedDocuments: inferRequiredCategoriesFromScrapedTender(scraped).requiredCategories,
        checklist: score.gaps.length
          ? score.gaps.map((gap) => ({ item: gap.requirement, status: 'missing' as const }))
          : [{ item: 'Required compliance documents are available', status: 'passed' as const }],
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      });
    }
    return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
  }
  return NextResponse.json(readiness, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
    },
  });
}
