import { createHash } from 'node:crypto';
import type { TenderDetail } from '@/lib/api/types';
import { getTenderById } from './firestoreService';
import { getScrapedTenders, type ScrapedTender } from './tenderScraper';

export function scrapedTenderId(tender: ScrapedTender): string {
  const raw = `${tender.sourceSite}|${tender.tenderNumber || tender.referenceNumber || tender.title}|${tender.deadline}`;
  return `scraped-${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
}

export function inferRequiredCategoriesFromTenderText(text: string): string[] {
  const lower = text.toLowerCase();
  const required = new Set<string>(['tax', 'registration']);

  if (/\bbbbee\b|\bb-bbee\b|\bbee\b|sworn affidavit/.test(lower)) required.add('bbbee');
  if (/\bcsd\b|central supplier database|supplier number/.test(lower)) required.add('registration');
  if (/\bcidb\b|construction|civil works|engineering/.test(lower)) required.add('certification');
  if (/financial statement|annual financial|bank statement|bank confirmation|turnover/.test(lower)) required.add('financial');
  if (/insurance|public liability|professional indemnity|letter of good standing|coida|safety file/.test(lower)) required.add('legal');

  return [...required];
}

export function inferRequiredCategoriesFromScrapedTender(tender: ScrapedTender): string[] {
  return inferRequiredCategoriesFromTenderText([
    tender.category,
    tender.rawCategory,
    tender.title,
    tender.description,
    tender.specialConditions,
    tender.fullText,
    ...(tender.requirements ?? []),
    ...(tender.eligibilityCriteria ?? []),
  ].join(' '));
}

export function mapScrapedTenderToDetail(tender: ScrapedTender): TenderDetail {
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

export async function resolveTender(tenderId: string): Promise<{
  tender: TenderDetail | null;
  scrapedTender: ScrapedTender | null;
}> {
  const tender = await getTenderById(tenderId);
  if (tender) return { tender, scrapedTender: null };

  const scrapedTender = (await getScrapedTenders()).find((item) => scrapedTenderId(item) === tenderId) ?? null;
  if (!scrapedTender) return { tender: null, scrapedTender: null };

  return {
    tender: mapScrapedTenderToDetail(scrapedTender),
    scrapedTender,
  };
}
