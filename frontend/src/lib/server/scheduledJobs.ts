import { buildComplianceScore } from '@/lib/utils/calculateReadinessScore';
import {
  applyHybridScoreAdjustment,
  buildTenderRequirementsFromTender,
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
  listAllDocuments,
  listAllUsers,
  listDocumentsForCompany,
  listTenders,
  upsertTenderMatch,
} from './firestoreService';
import { getScrapedTenders, runScrapeAll, type ScrapedTender } from './tenderScraper';
import { sendAuthEmail } from './authEmail';

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

async function importScrapedTenders(): Promise<{ importedTenderIds: string[]; skippedDuplicates: number }> {
  const scrapedTenders = getScrapedTenders();
  const existing = await listTenders();
  const existingKeys = new Set(existing.map((tender) => tenderKey(tender)));
  const importedTenderIds: string[] = [];
  let skippedDuplicates = 0;

  for (const scraped of scrapedTenders) {
    const key = `${scrapedTenderKey(scraped)}|${scraped.organization}|${scraped.deadline}`.toLowerCase();
    if (existingKeys.has(key)) {
      skippedDuplicates++;
      continue;
    }

    const tender = await createTender({
      title: scraped.title,
      organization: scraped.organization || scraped.organOfState || scraped.sourceSite,
      deadline: scraped.deadline || scraped.closingDate,
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
    });

    importedTenderIds.push(tender.id);
    existingKeys.add(key);
  }

  return { importedTenderIds, skippedDuplicates };
}

export async function runScanTenderPortalsJob(): Promise<ScheduledJobResult> {
  const checkedAt = new Date().toISOString();
  const scrapeResults = await runScrapeAll({ extractPdfs: true, scrapeDetails: true });
  const errors = scrapeResults.flatMap((result) => result.errors.map((error) => `${result.source}: ${error}`));
  const importResult = await importScrapedTenders();
  const matchResult = await runMatchTendersToCompaniesJob(importResult.importedTenderIds);

  return {
    job: 'scan_tender_portals',
    ok: errors.length === 0 && matchResult.errors.length === 0,
    checkedAt,
    scrapeResults,
    importedTenders: importResult.importedTenderIds.length,
    skippedDuplicates: importResult.skippedDuplicates,
    matchResult,
    errors: [...errors, ...matchResult.errors],
  };
}

export async function runMatchTendersToCompaniesJob(tenderIds?: string[]): Promise<ScheduledJobResult> {
  const checkedAt = new Date().toISOString();
  const [companies, tenders] = await Promise.all([listAllCompanies(), listTenders()]);
  const targetTenders = tenderIds?.length
    ? tenders.filter((tender) => tenderIds.includes(tender.id))
    : tenders.filter((tender) => tender.status === 'published');
  const errors: string[] = [];
  let matchesCreated = 0;
  let notificationsCreated = 0;

  for (const tender of targetTenders) {
    for (const company of companies) {
      try {
        const documents = await listDocumentsForCompany(company.id);
        const profile = generateComplianceProfile(company.id, documents);
        const requirements = buildTenderRequirementsFromTender(tender);
        const deterministic = calculateTenderMatchScore(company.id, tender.id, tender.title, profile, requirements);
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
          });
          notificationsCreated += notifications.length;
        }
      } catch (err) {
        errors.push(`Failed to match tender ${tender.id} to company ${company.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    job: 'match_tenders_to_companies',
    ok: errors.length === 0,
    checkedAt,
    tendersChecked: targetTenders.length,
    companiesChecked: companies.length,
    matchesCreated,
    notificationsCreated,
    errors,
  };
}

export async function runSendEmailDigestsJob(): Promise<ScheduledJobResult> {
  const checkedAt = new Date().toISOString();
  const users = (await listAllUsers()).filter((user) => user.role === 'user' && user.verificationStatus === 'approved');
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
      const result = await sendAuthEmail({
        to: user.email,
        subject: 'Weekly TenderGuard compliance summary',
        body: [
          `Hi ${user.fullName},`,
          '',
          `Compliance score: ${score.score} (${score.band})`,
          `Completed documents: ${score.completedDocuments}/${score.totalDocuments}`,
          `Missing documents: ${score.missingDocuments.length ? score.missingDocuments.join(', ') : 'None'}`,
          `Expiring within 30 days: ${expiring.length ? expiring.map((document) => document.name).join(', ') : 'None'}`,
          '',
          'Open TenderGuard to review your compliance status.',
        ].join('\n'),
      });

      if (result.sent) {
        sent++;
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
