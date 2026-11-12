import { NextResponse } from 'next/server';
import { getTenderById, getUserByToken, updateTender, deleteTender, getCompanyById } from '@/lib/server/firestoreService';
import { publishRescoreEvent } from '@/lib/server/analystEngine';
import { getScrapedTenders, type ScrapedTender } from '@/lib/server/tenderScraper';
import type { TenderDetail } from '@/lib/api/types';
import { isAdminRole } from '@/lib/server/apiAuth';
import { isPublishedTender, redactTender, viewerCanSeeUnpublished } from '@/lib/server/tenderAccess';
import { type TenderRequirements } from '@/lib/server/complianceScoring';
import { enrichTenderWithCompanyScore, scrapedTenderId } from '@/lib/server/tenderScoring';
import { toTenderAttachments } from '@/lib/server/tenderResolver';
import { resolveStoredTenderDocuments, sourceDocumentsToAttachments } from '@/lib/server/tenderSourceDocuments';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
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
    attachments: toTenderAttachments(tender.documents),
  };

  if (!companyId) return detail;

  // Score through the single source of truth so the detail page agrees with the list.
  return enrichTenderWithCompanyScore(detail, companyId, companyCategories);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const { tenderId } = await params;

  // Resolve the viewer's company so the match/readiness score is computed the
  // same way it is in the matches list. Without it, fall back to the raw tender.
  const token = parseToken(req);
  const user = token ? await getUserByToken(token) : null;
  const companyId = user?.activeCompanyId ?? undefined;
  const company = companyId ? await getCompanyById(companyId) : null;

  const tender = await getTenderById(tenderId);
  if (tender) {
    if (!isPublishedTender(tender.status) && !viewerCanSeeUnpublished(user?.role, tender.createdBy, user?.id)) {
      return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
    }
    const scored = companyId
      ? await enrichTenderWithCompanyScore(tender, companyId, company?.tenderCategories ?? [])
      : tender;
    // Stored tenders carry no document URLs of their own. Re-resolve the official
    // documents from the source release so the company sees and can download the
    // actual published tender, not only the generated summary.
    if (!scored.attachments?.length) {
      const sourceDocs = await resolveStoredTenderDocuments(scored);
      if (sourceDocs.length) scored.attachments = sourceDocumentsToAttachments(sourceDocs);
    }
    return NextResponse.json(redactTender(scored, Boolean(user)), {
      status: 200,
      headers: {
        'Cache-Control': companyId
          ? 'private, max-age=30, stale-while-revalidate=60'
          : 'public, max-age=60, stale-while-revalidate=120',
      },
    });
  }

  const scraped = (await getScrapedTenders()).find((item) => scrapedTenderId(item) === tenderId);
  if (!scraped) {
    return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
  }

  const detail = await mapScrapedTenderToDetail(scraped, companyId, company?.tenderCategories ?? []);
  return NextResponse.json(redactTender(detail, Boolean(user)), {
    status: 200,
    headers: {
      'Cache-Control': companyId
        ? 'private, max-age=30, stale-while-revalidate=60'
        : 'public, max-age=60, stale-while-revalidate=120',
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
  if (!isAdminRole(user.role) && user.role !== 'evaluator') {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
  }

  try {
    const { tenderId } = await params;
    const existing = await getTenderById(tenderId);
    if (!existing) {
      return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
    }
    if (!isAdminRole(user.role) && existing.createdBy !== user.id) {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
    }
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
  if (!isAdminRole(user.role) && user.role !== 'evaluator') {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
  }

  try {
    const { tenderId } = await params;
    const existing = await getTenderById(tenderId);
    if (!existing) {
      return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
    }
    if (!isAdminRole(user.role) && existing.createdBy !== user.id) {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
    }
    await deleteTender(tenderId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/tenders/[tenderId] error:', error);
    return NextResponse.json({ detail: 'Failed to delete tender' }, { status: 500 });
  }
}
