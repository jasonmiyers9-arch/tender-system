import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { listTenders, createTender, getCompanyById, getUserByToken, getTenderReadiness, listDocumentsForCompany } from '@/lib/server/firestoreService';
import { buildTenderRequirementsFromTender, publishRescoreEvent } from '@/lib/server/analystEngine';
import type { TenderMatch } from '@/lib/api/types';
import { getScrapedTenders, type ScrapedTender } from '@/lib/server/tenderScraper';
import { isAdminRole } from '@/lib/server/apiAuth';
import { calculateTenderMatchScore, generateComplianceProfile, type TenderRequirements } from '@/lib/server/complianceScoring';
import { normalizeTenderCategory } from '@/lib/server/tenderCategories';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
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
    return (
      tender === selected ||
      tender.includes(selected) ||
      selected.includes(tender) ||
      haystack.includes(rawSelected) ||
      haystack.includes(selected)
    );
  });
}

function scrapedTenderId(tender: ScrapedTender): string {
  const raw = `${tender.sourceSite}|${tender.tenderNumber || tender.referenceNumber || tender.title}|${tender.deadline}`;
  return `scraped-${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
}

function numericTenderValue(value: string): number | null {
  const normalized = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!normalized) return null;
  const amount = Number(normalized[0]);
  return Number.isFinite(amount) ? amount : null;
}

function applyDiscoveryFilters(items: TenderMatch[], params: URLSearchParams): TenderMatch[] {
  const query = params.get('q')?.trim().toLowerCase() || '';
  const province = params.get('province')?.trim().toLowerCase() || '';
  const category = params.get('category')?.trim().toLowerCase() || '';
  const buyer = params.get('buyer')?.trim().toLowerCase() || '';
  const tenderType = params.get('tenderType')?.trim().toLowerCase() || '';
  const briefing = params.get('briefing');
  const closingWithin = Number(params.get('closingWithin'));
  const minValue = Number(params.get('minValue'));
  const maxValue = Number(params.get('maxValue'));
  const now = Date.now();

  return items.filter((item) => {
    if (query) {
      const haystack = [item.title, item.description, item.organization, item.tenderNumber, item.category, item.province, item.location]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (province && (item.province || item.location || '').toLowerCase() !== province) return false;
    if (category && item.category.toLowerCase() !== category) return false;
    if (buyer && !item.organization.toLowerCase().includes(buyer)) return false;
    if (tenderType && !(item.tenderType || '').toLowerCase().includes(tenderType)) return false;
    if (briefing === 'true' && !item.briefing?.hasBriefingSession) return false;
    if (briefing === 'compulsory' && !item.briefing?.isCompulsory) return false;
    if (Number.isFinite(closingWithin) && closingWithin > 0) {
      const deadline = new Date(item.deadline).getTime();
      const days = Math.ceil((deadline - now) / 86_400_000);
      if (!Number.isFinite(deadline) || days < 0 || days > closingWithin) return false;
    }
    const value = numericTenderValue(item.value);
    if (Number.isFinite(minValue) && minValue > 0 && (value === null || value < minValue)) return false;
    if (Number.isFinite(maxValue) && maxValue > 0 && (value === null || value > maxValue)) return false;
    return true;
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

function mapScrapedTenderToMatch(tender: ScrapedTender, companyCategories: string[]): TenderMatch {
  const categoryHit = categoryMatches(tender.category, companyCategories, tender.fullText || tender.description || tender.title);
  const closingDate = tender.deadline || tender.closingDate || 'Not specified';
  const requiredAt = tender.deliveryLocation || tender.location || tender.province || 'Not specified';
  const requirements = inferRequiredCategoriesFromScrapedTender(tender);
  return {
    id: scrapedTenderId(tender),
    title: tender.title,
    organization: tender.organOfState || tender.organization || 'Unknown department',
    deadline: closingDate,
    value: tender.value || 'Not specified',
    matchScore: categoryHit ? 70 : 45,
    readinessScore: categoryHit ? 70 : 45,
    isBidReady: false,
    gaps: [],
    category: tender.category,
    location: requiredAt,
    description: tender.description || tender.specialConditions || tender.title,
    advertised: tender.advertised || tender.datePublished,
    closingTime: tender.closingTime || 'Not specified',
    requiredAt,
    sourceUrl: tender.sourceUrl,
    sourceSite: tender.sourceSite,
    tenderNumber: tender.tenderNumber || tender.referenceNumber,
    tenderType: tender.tenderType,
    province: tender.province,
    specialConditions: tender.specialConditions,
    briefing: tender.briefing,
    contact: tender.contact,
    isScraped: true,
    recommendationReason: categoryHit
      ? `Recommended because it matches your selected category and requires: ${requirements.requiredCategories.join(', ')}.`
      : 'Listed from scraped tender sources.',
    requirements: tender.requirements?.length ? tender.requirements : [tender.specialConditions].filter(Boolean),
    eligibilityCriteria: tender.eligibilityCriteria ?? [],
    recommendedDocuments: tender.requirements?.length ? tender.requirements : [],
    required_categories: requirements.requiredCategories,
    status: 'published',
    createdAt: tender.scrapedAt,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mineOnly = url.searchParams.get('mine') === 'true';
  const token = parseToken(req);
  
  // Get user for company context
  let companyId: string | undefined;
  let companyCategories: string[] = [];
  if (token) {
    const user = await getUserByToken(token);
    if (user?.activeCompanyId) {
      companyId = user.activeCompanyId;
      const company = await getCompanyById(companyId);
      companyCategories = company?.tenderCategories ?? [];
    }
    
    // Tender ownership management is an administrative function.
    if (mineOnly) {
      if (!user) {
        return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
      }
      if (!isAdminRole(user.role)) {
        return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
      }
      const items = await listTenders({ createdBy: user.id, includeSystem: false });
      return NextResponse.json(items, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
        },
      });
    }
  }

  const items = (await listTenders())
    .filter((tender) => categoryMatches(
      tender.category,
      companyCategories,
      `${tender.title} ${tender.description ?? ''} ${(tender.requirements ?? []).join(' ')} ${(tender.eligibilityCriteria ?? []).join(' ')}`,
    ));
  const scrapedMatches = (await getScrapedTenders())
    .filter((tender) => categoryMatches(tender.category, companyCategories, tender.fullText || tender.description || tender.title))
    .map((tender) => mapScrapedTenderToMatch(tender, companyCategories));
  const deduplicated = new Map<string, TenderMatch>();
  for (const item of [...scrapedMatches, ...items]) {
    const key = `${item.sourceSite || item.organization}|${item.tenderNumber || item.title}|${item.deadline}`.toLowerCase();
    deduplicated.set(key, item);
  }
  const allItems = applyDiscoveryFilters([...deduplicated.values()], url.searchParams);
  
  // If company context available, enrich with readiness scores
  if (companyId) {
    const documents = await listDocumentsForCompany(companyId);
    const profile = generateComplianceProfile(companyId, documents);
    const enrichedItems: TenderMatch[] = await Promise.all(
      allItems.map(async (tender) => {
        if (tender.isScraped) {
          const requirements = buildTenderRequirementsFromTender(tender);
          const score = calculateTenderMatchScore(companyId, tender.id, tender.title, profile, requirements);
          const categoryHit = categoryMatches(tender.category, companyCategories, `${tender.description ?? ''} ${(tender.requirements ?? []).join(' ')}`);
          const categoryBonus = categoryHit ? 10 : 0;
          const readinessScore = score.missingDocuments.length > 0 ? Math.min(99, score.matchScore + categoryBonus) : Math.min(100, score.matchScore + categoryBonus);
          return {
            ...tender,
            matchScore: readinessScore,
            readinessScore,
            scoreBreakdown: {
              documentCompleteness: Math.round(score.breakdown.documentCompleteness * 0.3),
              verificationCoverage: Math.round(score.breakdown.verificationStatus * 0.25),
              csdProfileCompleteness: Math.round(score.breakdown.requirementMatch * 0.2),
              complianceConsistency: Math.round(score.breakdown.documentValidity * 0.15),
              tenderFitBonus: categoryHit ? 10 : Math.round(score.breakdown.bonusPoints),
            },
            isBidReady: score.isEligible && readinessScore >= 75,
            gaps: score.gaps.map((gap) => gap.recommendation),
            recommendationReason: categoryHit
              ? `${score.recommendation}. Category match: ${tender.category}.`
              : score.recommendation,
          };
        }
        const readiness = await getTenderReadiness(tender.id, companyId);
        if (readiness) {
          return {
            ...tender,
            matchScore: readiness.readinessScore, // Use new readiness score
            readinessScore: readiness.readinessScore,
            scoreBreakdown: readiness.scoreBreakdown,
            isBidReady: readiness.isBidReady,
            gaps: readiness.gaps,
          };
        }
        return tender;
      })
    );
    
    enrichedItems.sort((a, b) => {
      const scoreDiff = (b.readinessScore ?? b.matchScore) - (a.readinessScore ?? a.matchScore);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.deadline || '9999-12-31').getTime() - new Date(b.deadline || '9999-12-31').getTime();
    });

    return NextResponse.json(enrichedItems, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  }

  return NextResponse.json(allItems, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
    },
  });
}

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
    if (!isAdminRole(user.role)) {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      organization,
      deadline,
      value,
      category,
      location,
      description,
      requirements,
      eligibilityCriteria,
      required_categories,
      status,
    } = body;

    if (!title || !organization || !deadline || !value || !category || !location || !description) {
      return NextResponse.json(
        { detail: 'Missing required fields: title, organization, deadline, value, category, location, description' },
        { status: 400 },
      );
    }

    const tender = await createTender({
      title,
      organization,
      deadline,
      value,
      category,
      location,
      description,
      requirements: Array.isArray(requirements) ? requirements : [],
      eligibilityCriteria: Array.isArray(eligibilityCriteria) ? eligibilityCriteria : [],
      required_categories: Array.isArray(required_categories) ? required_categories : [],
      status: status === 'published' ? 'published' : 'draft',
      createdBy: user.id,
      companyId: user.activeCompanyId ?? undefined,
    });

    if (tender.companyId) {
      await publishRescoreEvent({
        eventType: 'tender.created',
        companyId: tender.companyId,
        actorUserId: user.id,
        tenderId: tender.id,
        metadata: { status: tender.status },
      });
    }

    return NextResponse.json(tender, { status: 201 });
  } catch (error) {
    console.error('POST /api/tenders error:', error);
    return NextResponse.json({ detail: 'Failed to create tender' }, { status: 500 });
  }
}
