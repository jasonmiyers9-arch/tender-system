import { buildComplianceScore } from '@/lib/utils/calculateReadinessScore';
import {
  applyHybridScoreAdjustment,
  buildTenderRequirementsFromTender,
  type HybridAdjustmentResult,
} from './analystEngine';
import {
  calculateTenderMatchScore,
  generateComplianceProfile,
} from './complianceScoring';
import {
  createAnalystRun,
  createNotificationsForCompany,
  createScoreHistoryRecord,
  createTender,
  listAllCompanies,
  listAllUsers,
  listDocumentsForCompany,
  listSavedTenderSearches,
  listTenders,
  markSavedTenderSearchDelivered,
  updateTender,
  upsertTenderMatch,
} from './firestoreService';
import { getScrapedTenders, runScrapeAll, type ScrapedTender } from './tenderScraper';
import { sendAuthEmail } from './authEmail';
import type { SavedTenderSearchRecord } from './firestoreService';
import type { TenderMatch } from '@/lib/api/types';

export interface ScheduledJobResult {
  job: string;
  ok: boolean;
  checkedAt: string;
  errors: string[];
  [key: string]: unknown;
}

function scrapedTenderKey(tender: ScrapedTender): string {
  return `${tender.tenderNumber || tender.referenceNumber || tender.title}`.trim().toLowerCase();
}

function tenderKey(tender: { tenderNumber?: string; title: string; organization: string; deadline: string }): string {
  return `${tender.tenderNumber || tender.title}|${tender.organization}|${tender.deadline}`.trim().toLowerCase();
}

function normalizeRequiredCategories(tender: ScrapedTender): string[] {
  const text = [
    tender.rawCategory,
    tender.category,
    tender.title,
    tender.description,
    tender.specialConditions,
    tender.fullText,
  ].join(' ').toLowerCase();
  const categories = new Set<string>();

  if (/(tax|sars|pin|tcs)/.test(text)) categories.add('tax');
  if (/(cipc|registration|registered company|company profile|csd)/.test(text)) categories.add('registration');
  if (/(b-bbee|bbbee|bee)/.test(text)) categories.add('bbbee');
  if (/(cidb|nhbrc|iso|certificat|accredit)/.test(text)) categories.add('certification');
  if (/(financial|bank|audited|statements)/.test(text)) categories.add('financial');
  if (/(insurance|indemnity|liability|legal|coida|good standing)/.test(text)) categories.add('legal');
  if (/(health|safety|quality|environmental|policy)/.test(text)) categories.add('policy');

  return categories.size > 0 ? [...categories] : ['tax', 'registration'];
}

function matchesSavedSearch(tender: TenderMatch, search: SavedTenderSearchRecord, since: number): boolean {
  const filters = search.filters;
  const publishedAt = new Date(tender.advertised || tender.createdAt || 0).getTime();
  if (!Number.isFinite(publishedAt) || publishedAt < since) return false;
  const haystack = [tender.title, tender.description, tender.organization, tender.tenderNumber, tender.category, tender.location]
    .filter(Boolean).join(' ').toLowerCase();
  if (filters.q && !haystack.includes(filters.q.toLowerCase())) return false;
  if (filters.province && (tender.province || tender.location || '').toLowerCase() !== filters.province.toLowerCase()) return false;
  if (filters.category && tender.category.toLowerCase() !== filters.category.toLowerCase()) return false;
  if (filters.buyer && !tender.organization.toLowerCase().includes(filters.buyer.toLowerCase())) return false;
  if (filters.tenderType && !(tender.tenderType || '').toLowerCase().includes(filters.tenderType.toLowerCase())) return false;
  if (filters.briefing === 'true' && !tender.briefing?.hasBriefingSession) return false;
  if (filters.briefing === 'compulsory' && !tender.briefing?.isCompulsory) return false;
  if (filters.closingWithin) {
    const days = Math.ceil((new Date(tender.deadline).getTime() - Date.now()) / 86_400_000);
    if (!Number.isFinite(days) || days < 0 || days > filters.closingWithin) return false;
  }
  const valueMatch = tender.value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  const value = valueMatch ? Number(valueMatch[0]) : null;
  if (filters.minValue && (value === null || value < filters.minValue)) return false;
  if (filters.maxValue && (value === null || value > filters.maxValue)) return false;
  return true;
}

export async function importScrapedTenders(options?: { scrapedSince?: string }): Promise<{ importedTenderIds: string[]; skippedDuplicates: number }> {
  const scrapedTenders = getScrapedTenders().filter((tender) => !options?.scrapedSince || tender.scrapedAt >= options.scrapedSince);
  const existing = await listTenders();
  const existingByKey = new Map(existing.map((tender) => [tenderKey(tender), tender]));
  const importedTenderIds: string[] = [];
  let skippedDuplicates = 0;

  for (const scraped of scrapedTenders) {
    const key = `${scrapedTenderKey(scraped)}|${scraped.organization}|${scraped.deadline}`.toLowerCase();
    const existingTender = existingByKey.get(key);
    if (existingTender) {
      await updateTender(existingTender.id, {
        title: scraped.title,
        organization: scraped.organization || scraped.organOfState || scraped.sourceSite,
        deadline: scraped.deadline || scraped.closingDate || existingTender.deadline,
        value: scraped.value || existingTender.value,
        category: scraped.category || scraped.rawCategory || existingTender.category,
        location: scraped.location || scraped.province || scraped.deliveryLocation || existingTender.location,
        description: scraped.description || scraped.fullText.slice(0, 1000),
        requirements: scraped.requirements,
        eligibilityCriteria: scraped.eligibilityCriteria,
        required_categories: normalizeRequiredCategories(scraped),
        advertised: scraped.advertised || scraped.datePublished,
        closingTime: scraped.closingTime,
        sourceUrl: scraped.sourceUrl,
        sourceSite: scraped.sourceSite,
        tenderNumber: scraped.tenderNumber || scraped.referenceNumber,
        tenderType: scraped.tenderType,
        province: scraped.province,
        specialConditions: scraped.specialConditions,
        briefing: scraped.briefing,
        contact: scraped.contact,
        status: 'published',
      });
      skippedDuplicates++;
      continue;
    }

    const tender = await createTender({
      title: scraped.title,
      organization: scraped.organization || scraped.organOfState || scraped.sourceSite,
      deadline: scraped.deadline || scraped.closingDate || 'Not specified',
      value: scraped.value || 'Not specified',
      category: scraped.category || scraped.rawCategory || 'Other',
      location: scraped.location || scraped.province || scraped.deliveryLocation || 'South Africa',
      description: scraped.description || scraped.fullText.slice(0, 1000),
      requirements: scraped.requirements,
      eligibilityCriteria: scraped.eligibilityCriteria,
      required_categories: normalizeRequiredCategories(scraped),
      status: 'published',
      isSystem: true,
      advertised: scraped.advertised || scraped.datePublished,
      closingTime: scraped.closingTime,
      sourceUrl: scraped.sourceUrl,
      sourceSite: scraped.sourceSite,
      tenderNumber: scraped.tenderNumber || scraped.referenceNumber,
      tenderType: scraped.tenderType,
      province: scraped.province,
      specialConditions: scraped.specialConditions,
      briefing: scraped.briefing,
      contact: scraped.contact,
    });

    importedTenderIds.push(tender.id);
    existingByKey.set(key, tender);
  }

  return { importedTenderIds, skippedDuplicates };
}

export async function importAndMatchScrapedTenders(): Promise<{
  importedTenderIds: string[];
  skippedDuplicates: number;
  matchResult: ScheduledJobResult;
}> {
  const importResult = await importScrapedTenders();
  const matchResult = await runMatchTendersToCompaniesJob(importResult.importedTenderIds);
  return {
    ...importResult,
    matchResult,
  };
}

export async function runScanTenderPortalsJob(): Promise<ScheduledJobResult> {
  const checkedAt = new Date().toISOString();
  // Keep the scheduled ingestion inside serverless limits. Document packs are retained
  // for targeted/deep enrichment, while OCDS supplies the core structured metadata.
  const scrapeResults = await runScrapeAll({ maxPages: 1, extractPdfs: false, scrapeDetails: false });
  const errors = scrapeResults.flatMap((result) => result.errors.map((error) => `${result.source}: ${error}`));
  const importResult = await importScrapedTenders();

  return {
    job: 'scan_tender_portals',
    ok: errors.length === 0,
    checkedAt,
    scrapeResults,
    importedTenders: importResult.importedTenderIds.length,
    skippedDuplicates: importResult.skippedDuplicates,
    matchingDeferred: true,
    errors,
  };
}

export async function runMatchTendersToCompaniesJob(tenderIds?: string[]): Promise<ScheduledJobResult> {
  const checkedAt = new Date().toISOString();
  const [companies, tenders] = await Promise.all([listAllCompanies(), listTenders()]);
  const recentCutoff = Date.now() - 2 * 86_400_000;
  const candidateTenders = tenderIds?.length
    ? tenders.filter((tender) => tenderIds.includes(tender.id))
    : tenders.filter((tender) => {
        if (tender.status !== 'published') return false;
        const deadline = new Date(tender.deadline).getTime();
        if (Number.isFinite(deadline) && deadline < Date.now()) return false;
        const published = new Date(tender.advertised || tender.createdAt || 0).getTime();
        return Number.isFinite(published) && published >= recentCutoff;
      });
  const scheduledLimit = Math.max(1, Number(process.env.SCHEDULED_MATCH_TENDER_LIMIT) || 100);
  const targetTenders = (tenderIds?.length ? candidateTenders : candidateTenders
    .sort((a, b) => new Date(b.advertised || b.createdAt || 0).getTime() - new Date(a.advertised || a.createdAt || 0).getTime())
    .slice(0, scheduledLimit));
  const useScheduledAi = process.env.ENABLE_SCHEDULED_AI_MATCHING === 'true';
  const errors: string[] = [];
  let matchesCreated = 0;
  let notificationsCreated = 0;

  const companyContexts = await Promise.all(companies.map(async (company) => {
    const documents = await listDocumentsForCompany(company.id);
    return { company, profile: generateComplianceProfile(company.id, documents) };
  }));
  const workItems = targetTenders.flatMap((tender) => companyContexts
    .filter(({ company }) => {
      const selected = company.tenderCategories ?? [];
      if (!selected.length) return true;
      const category = tender.category.toLowerCase();
      return selected.some((value) => {
        const normalized = value.toLowerCase();
        return category === normalized || category.includes(normalized) || normalized.includes(category);
      });
    })
    .map((context) => ({ tender, ...context })));

  for (let offset = 0; offset < workItems.length; offset += 10) {
    await Promise.all(workItems.slice(offset, offset + 10).map(async ({ tender, company, profile }) => {
      try {
        const requirements = buildTenderRequirementsFromTender(tender);
        const deterministic = calculateTenderMatchScore(company.id, tender.id, tender.title, profile, requirements);
        const hybrid: HybridAdjustmentResult = useScheduledAi
          ? await applyHybridScoreAdjustment({
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
            })
          : {
              adjustedScore: deterministic.matchScore,
              llmDeltaApplied: 0,
              confidenceScore: deterministic.confidenceScore,
              reasonCodes: ['deterministic_fallback'],
              analystSummary: deterministic.recommendation,
              model: 'deterministic-scheduled',
              promptVersion: 'deterministic-v1',
              source: 'deterministic',
            };

        await upsertTenderMatch({
          tenderId: tender.id,
          tenderTitle: tender.title,
          companyId: company.id,
          score: hybrid.adjustedScore,
          deterministicScore: deterministic.matchScore,
          llmDeltaApplied: hybrid.llmDeltaApplied,
          confidenceScore: hybrid.confidenceScore,
          reasonCodes: hybrid.reasonCodes,
          recommendation: deterministic.recommendation,
          missingDocuments: deterministic.missingDocuments,
          strengths: deterministic.strengths,
          priorityActions: deterministic.priorityActions.map((action) => action.title),
          source: hybrid.source,
          model: hybrid.model,
          promptVersion: hybrid.promptVersion,
        });
        await createAnalystRun({
          companyId: company.id,
          tenderId: tender.id,
          tenderTitle: tender.title,
          trigger: 'scheduled.match_tenders_to_companies',
          actorUserId: null,
          score: hybrid.adjustedScore,
          deterministicScore: deterministic.matchScore,
          llmDeltaApplied: hybrid.llmDeltaApplied,
          confidenceScore: hybrid.confidenceScore,
          reasonCodes: hybrid.reasonCodes,
          recommendation: deterministic.recommendation,
          missingDocuments: deterministic.missingDocuments,
          strengths: deterministic.strengths,
          priorityActions: deterministic.priorityActions.map((action) => action.title),
          breakdown: deterministic.breakdown,
          source: hybrid.source,
          model: hybrid.model,
          promptVersion: hybrid.promptVersion,
        });
        matchesCreated++;

        if (hybrid.adjustedScore >= 60) {
          const notifications = await createNotificationsForCompany(company.id, {
            alertType: 'info',
            title: 'Tender match found',
            message: `${tender.title} matches your company at ${hybrid.adjustedScore}%.`,
            triggerDate: checkedAt,
            dedupeKey: `tender-match:${tender.id}:${company.id}:${hybrid.adjustedScore}`,
          }, { deliver: false });
          notificationsCreated += notifications.length;
        }
      } catch (err) {
        errors.push(`Failed to match tender ${tender.id} to company ${company.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }));
  }

  return {
    job: 'match_tenders_to_companies',
    ok: errors.length === 0,
    checkedAt,
    tendersChecked: targetTenders.length,
    companiesChecked: companies.length,
    companyTenderPairsChecked: workItems.length,
    scheduledLimit: tenderIds?.length ? null : scheduledLimit,
    matchesCreated,
    notificationsCreated,
    errors,
  };
}

export async function runSendEmailDigestsJob(): Promise<ScheduledJobResult> {
  const checkedAt = new Date().toISOString();
  const users = (await listAllUsers()).filter((user) => user.role === 'user' && user.verificationStatus === 'approved');
  const availableTenders = await listTenders();
  const errors: string[] = [];
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const companyId = user.activeCompanyId ?? user.companyId;
    if (!companyId) {
      skipped++;
      continue;
    }

    try {
      const documents = await listDocumentsForCompany(companyId);
      const score = buildComplianceScore(documents);
      const expiring = documents.filter((document) => document.expiryDate && new Date(document.expiryDate) <= new Date(Date.now() + 30 * 86_400_000));
      const searches = (await listSavedTenderSearches(user.id)).filter((search) => search.enabled && search.frequency !== 'paused');
      const searchSections: string[] = [];
      const deliveredSearches: SavedTenderSearchRecord[] = [];
      for (const search of searches) {
        const interval = search.frequency === 'weekly' ? 7 * 86_400_000 : 86_400_000;
        const since = search.lastDeliveredAt ? new Date(search.lastDeliveredAt).getTime() : Date.now() - interval;
        if (search.lastDeliveredAt && Date.now() - since < interval * 0.8) continue;
        const matches = availableTenders.filter((tender) => matchesSavedSearch(tender, search, since)).slice(0, 20);
        if (!matches.length) continue;
        searchSections.push('', `${search.name} (${matches.length} new)`, ...matches.map((tender) => `- ${tender.title} — closes ${tender.deadline}`));
        deliveredSearches.push(search);
      }
      const result = await sendAuthEmail({
        to: user.email,
        subject: searchSections.length ? 'TenderGuard tender alerts and compliance summary' : 'TenderGuard compliance summary',
        body: [
          `Hi ${user.fullName},`,
          '',
          `Compliance score: ${score.score} (${score.band})`,
          `Completed documents: ${score.completedDocuments}/${score.totalDocuments}`,
          `Missing documents: ${score.missingDocuments.length ? score.missingDocuments.join(', ') : 'None'}`,
          `Expiring within 30 days: ${expiring.length ? expiring.map((document) => document.name).join(', ') : 'None'}`,
          ...searchSections,
          '',
          'Open TenderGuard to review your compliance status.',
        ].join('\n'),
      });

      if (result.sent) {
        sent++;
        await Promise.all(deliveredSearches.map((search) => markSavedTenderSearchDelivered(search.id, checkedAt)));
      } else {
        skipped++;
        if (result.reason) errors.push(`${user.email}: ${result.reason}`);
      }
    } catch (err) {
      errors.push(`Failed digest for ${user.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    job: 'send_email_digests',
    ok: errors.length === 0,
    checkedAt,
    usersChecked: users.length,
    sent,
    skipped,
    errors,
  };
}

export async function runCleanupExpiredSessionsJob(): Promise<ScheduledJobResult> {
  return {
    job: 'cleanup_expired_sessions',
    ok: true,
    checkedAt: new Date().toISOString(),
    removedTokens: 0,
    skipped: true,
    reason: 'No Redis refresh-token store is configured in this codebase. Redis TTL cleanup should remove expired tokens automatically when refresh tokens are introduced.',
    errors: [],
  };
}

export async function runGenerateScoreSnapshotsJob(): Promise<ScheduledJobResult> {
  const checkedAt = new Date().toISOString();
  const snapshotDate = checkedAt.slice(0, 10);
  const companies = await listAllCompanies();
  const errors: string[] = [];
  let snapshotsCreated = 0;

  for (const company of companies) {
    try {
      const documents = await listDocumentsForCompany(company.id);
      const score = buildComplianceScore(documents);
      await createScoreHistoryRecord({
        companyId: company.id,
        score: score.score,
        band: score.band,
        completedDocuments: score.completedDocuments,
        totalDocuments: score.totalDocuments,
        missingDocuments: score.missingDocuments,
        expiringDocuments: score.expiringDocuments,
        snapshotDate,
      });
      snapshotsCreated++;
    } catch (err) {
      errors.push(`Failed score snapshot for company ${company.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    job: 'generate_score_snapshots',
    ok: errors.length === 0,
    checkedAt,
    companiesChecked: companies.length,
    snapshotsCreated,
    errors,
  };
}
