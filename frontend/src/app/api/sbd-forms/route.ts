import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import type { TenderDetail } from '@/lib/api/types';
import { getCompanyById, getTenderById, listDocumentsForCompany } from '@/lib/server/firestoreService';
import { requireAuth, resolveCompanyContext } from '@/lib/server/apiAuth';
import { getScrapedTenders, type ScrapedTender } from '@/lib/server/tenderScraper';
import { createSbdPackFilename, generateSbdPackHtml, normalizeSbdFormIds } from '@/lib/server/sbdForms';

function scrapedTenderId(tender: ScrapedTender): string {
  const raw = `${tender.sourceSite}|${tender.tenderNumber || tender.referenceNumber || tender.title}|${tender.deadline}`;
  return `scraped-${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
}

function inferRequiredCategoriesFromScrapedTender(tender: ScrapedTender): string[] {
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

  if (/\bbbbee\b|\bb-bbee\b|\bbee\b|sworn affidavit/.test(text)) required.add('bbbee');
  if (/\bcsd\b|central supplier database|supplier number/.test(text)) required.add('registration');
  if (/\bcidb\b|construction|civil works|engineering/.test(text)) required.add('certification');
  if (/financial statement|annual financial|bank statement|bank confirmation|turnover/.test(text)) required.add('financial');
  if (/insurance|public liability|professional indemnity|letter of good standing|coida|safety file/.test(text)) required.add('legal');

  return [...required];
}

function mapScrapedTenderToDetail(tender: ScrapedTender): TenderDetail {
  const requiredCategories = inferRequiredCategoriesFromScrapedTender(tender);
  return {
    id: scrapedTenderId(tender),
    title: tender.title,
    organization: tender.organOfState || tender.organization || 'Unknown department',
    deadline: tender.deadline || tender.closingDate || 'Not specified',
    value: tender.value || 'Not specified',
    matchScore: 0,
    gaps: [],
    category: tender.category,
    location: tender.deliveryLocation || tender.location || tender.province || 'Not specified',
    description: tender.description || tender.specialConditions || tender.title,
    advertised: tender.advertised || tender.datePublished,
    closingTime: tender.closingTime || 'Not specified',
    requiredAt: tender.deliveryLocation || tender.location || tender.province || 'Not specified',
    sourceUrl: tender.sourceUrl,
    sourceSite: tender.sourceSite,
    tenderNumber: tender.tenderNumber || tender.referenceNumber,
    tenderType: tender.tenderType,
    province: tender.province,
    specialConditions: tender.specialConditions,
    briefing: tender.briefing,
    contact: tender.contact,
    isScraped: true,
    requirements: tender.requirements?.length ? tender.requirements : [tender.specialConditions].filter(Boolean),
    eligibilityCriteria: tender.eligibilityCriteria ?? [],
    recommendedDocuments: requiredCategories,
    required_categories: requiredCategories,
    status: 'published',
    createdAt: tender.scrapedAt,
  };
}

async function resolveTenderForSbd(tenderId: string | null): Promise<{ tender: TenderDetail | null; sourceDocuments: ScrapedTender['documents'] }> {
  if (!tenderId) return { tender: null, sourceDocuments: [] };

  const tender = await getTenderById(tenderId);
  if (tender) return { tender, sourceDocuments: [] };

  const scraped = (await getScrapedTenders()).find((item) => scrapedTenderId(item) === tenderId);
  if (!scraped) return { tender: null, sourceDocuments: [] };

  return {
    tender: mapScrapedTenderToDetail(scraped),
    sourceDocuments: scraped.documents ?? [],
  };
}

export async function GET(req: Request) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    const url = new URL(req.url);
    const tenderId = url.searchParams.get('tenderId');
    const requestedForms = normalizeSbdFormIds(url.searchParams.getAll('form'));
    const companyId = await resolveCompanyContext(user!.id, user!.activeCompanyId);

    if (!companyId) {
      return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
    }

    const [company, documents, tenderResult] = await Promise.all([
      getCompanyById(companyId),
      listDocumentsForCompany(companyId),
      resolveTenderForSbd(tenderId),
    ]);

    if (!company) {
      return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
    }

    if (tenderId && !tenderResult.tender) {
      return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
    }

    const html = generateSbdPackHtml({
      company,
      documents,
      tender: tenderResult.tender,
      tenderSourceDocuments: tenderResult.sourceDocuments,
      requestedForms,
    });
    const filename = createSbdPackFilename(company.name, tenderResult.tender?.title);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/sbd-forms error:', error);
    return NextResponse.json({ detail: 'Failed to generate SBD forms' }, { status: 500 });
  }
}