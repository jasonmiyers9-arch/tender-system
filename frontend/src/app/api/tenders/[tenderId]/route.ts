import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getTenderById, getUserByToken, updateTender, deleteTender, listDocumentsForCompany, getCompanyById } from '@/lib/server/firestoreService';
import { buildTenderRequirementsFromTender, publishRescoreEvent } from '@/lib/server/analystEngine';
import { getScrapedTenders, type ScrapedTender } from '@/lib/server/tenderScraper';
import type { TenderDetail } from '@/lib/api/types';
import { isAdminRole } from '@/lib/server/apiAuth';
import { calculateTenderMatchScore, generateComplianceProfile, type TenderRequirements } from '@/lib/server/complianceScoring';
import { normalizeTenderCategory } from '@/lib/server/tenderCategories';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

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

async function mapScrapedTenderToDetail(tender: ScrapedTender, companyId?: string, companyCategories: string[] = []): Promise<TenderDetail> {
  const closingDate = tender.deadline || tender.closingDate || 'Not specified';
  const requiredAt = tender.deliveryLocation || tender.location || tender.province || 'Not specified';
  const requirements = inferRequiredCategoriesFromScrapedTender(tender);
  const detail: TenderDetail = {
    id: scrapedTenderId(tender),
    title: tender.title,
    organization: tender.organOfState || tender.organization || 'Unknown department',
    deadline: closingDate,
    value: tender.value || 'Not specified',
    matchScore: 70,
    readinessScore: 70,
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
    recommendationReason: `Recommended from scraped source category: ${tender.category}.`,
    requirements: tender.requirements?.length ? tender.requirements : [tender.specialConditions].filter(Boolean),
    eligibilityCriteria: tender.eligibilityCriteria ?? [],
    recommendedDocuments: requirements.requiredCategories,
    required_categories: requirements.requiredCategories,
    status: 'published',
    createdAt: tender.scrapedAt,
  };

  if (!companyId) return detail;

  const documents = await listDocumentsForCompany(companyId);
  const profile = generateComplianceProfile(companyId, documents);
  const score = calculateTenderMatchScore(companyId, detail.id, detail.title, profile, buildTenderRequirementsFromTender(detail));
  const categoryHit = categoryMatches(tender.category, companyCategories, tender.fullText || tender.description || tender.title);
  const readinessScore = score.missingDocuments.length > 0 ? Math.min(99, score.matchScore + (categoryHit ? 10 : 0)) : Math.min(100, score.matchScore + (categoryHit ? 10 : 0));
  return {
    ...detail,
    matchScore: readinessScore,
    readinessScore,
    isBidReady: score.missingDocuments.length === 0 && readinessScore >= 100,
    gaps: score.gaps.map((gap) => gap.recommendation),
    recommendationReason: `${score.recommendation}. Category: ${tender.category}.`,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const { tenderId } = await params;
  const tender = await getTenderById(tenderId);
  if (tender) {
    return NextResponse.json(tender, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      },
    });
  }

  const scraped = (await getScrapedTenders()).find((item) => scrapedTenderId(item) === tenderId);
  if (!scraped) {
    return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
  }

  const token = parseToken(req);
  const user = token ? await getUserByToken(token) : null;
  const company = user?.activeCompanyId ? await getCompanyById(user.activeCompanyId) : null;
  return NextResponse.json(await mapScrapedTenderToDetail(scraped, user?.activeCompanyId ?? undefined, company?.tenderCategories ?? []), {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
  }

  try {
    const { tenderId } = await params;
    const body = await req.json();
    const updated = await updateTender(tenderId, {
      title: body?.title,
      organization: body?.organization,
      deadline: body?.deadline,
      value: body?.value,
      category: body?.category,
      location: body?.location,
      description: body?.description,
      requirements: Array.isArray(body?.requirements) ? body.requirements : undefined,
      eligibilityCriteria: Array.isArray(body?.eligibilityCriteria) ? body.eligibilityCriteria : undefined,
      required_categories: Array.isArray(body?.required_categories) ? body.required_categories : undefined,
      status: body?.status,
    });

    if (updated.companyId) {
      await publishRescoreEvent({
        eventType: 'tender.updated',
        companyId: updated.companyId,
        actorUserId: user.id,
        tenderId: updated.id,
        metadata: { status: updated.status },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/tenders/[tenderId] error:', error);
    return NextResponse.json({ detail: 'Failed to update tender' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
  }

  try {
    const { tenderId } = await params;
    await deleteTender(tenderId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/tenders/[tenderId] error:', error);
    return NextResponse.json({ detail: 'Failed to delete tender' }, { status: 500 });
  }
}
