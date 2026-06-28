/**
 * Unified Tender Scoring — single source of truth.
 *
 * Every surface that shows a "Tender Match" / readiness number for a company
 * (the matches list, the tender detail page, the calendar, the readiness panel,
 * the AI advisor) MUST go through this module. Previously each route computed
 * the score its own way, so the same tender could read "Strong Match" in the
 * list and "Low Match" on the detail page. The contract here removes that:
 *
 *   matchScore === readinessScore   (the same company-aware fit number)
 *
 * so a tender is labelled identically wherever it appears.
 */
import { createHash } from 'node:crypto';
import type { TenderMatch, TenderReadinessScoreBreakdown } from '@/lib/api/types';
import {
  calculateTenderMatchScore,
  generateComplianceProfile,
  type CompanyComplianceProfile,
} from './complianceScoring';
import { buildTenderRequirementsFromTender } from './analystEngine';
import { getTenderReadiness, listDocumentsForCompany } from './firestoreService';
import { normalizeTenderCategory } from './tenderCategories';
import type { ScrapedTender } from './tenderScraper';

const CATEGORY_BONUS = 10;

export function normalizeCategory(value: string): string {
  const normalized = normalizeTenderCategory(value);
  return normalized === 'Other' ? value.trim().toLowerCase() : normalized.toLowerCase();
}

/**
 * Does a tender's category (or its text) line up with the company's selected
 * tender categories? Empty company categories means "show everything".
 */
export function categoryMatches(tenderCategory: string, companyCategories: string[], tenderText = ''): boolean {
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

/** Stable, deterministic id for a scraped tender (must match across all routes). */
export function scrapedTenderId(tender: ScrapedTender): string {
  const raw = `${tender.sourceSite}|${tender.tenderNumber || tender.referenceNumber || tender.title}|${tender.deadline}`;
  return `scraped-${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
}

function tenderMatchText(tender: TenderMatch): string {
  return [
    tender.description ?? '',
    tender.specialConditions ?? '',
    ...(tender.requirements ?? []),
    ...(tender.eligibilityCriteria ?? []),
    ...(tender.required_categories ?? []),
    ...(tender.recommendedDocuments ?? []),
  ].join(' ');
}

/** Apply the company-fit bonus and clamp; a tender with gaps can never read 100. */
export function applyReadinessBonus(matchScore: number, hasGaps: boolean, categoryHit: boolean): number {
  const bonus = categoryHit ? CATEGORY_BONUS : 0;
  return hasGaps ? Math.min(99, matchScore + bonus) : Math.min(100, matchScore + bonus);
}

/**
 * Score a single tender against a company and return the tender with its
 * scoring fields populated. `matchScore` is deliberately set equal to
 * `readinessScore` so every view labels the tender the same way.
 *
 * - Scraped tenders are scored from their inferred requirements + the company's
 *   compliance profile (pass a pre-built `profile` to avoid re-loading docs when
 *   scoring a whole list).
 * - Stored tenders go through the richer Tender Readiness Score™ engine.
 */
export async function enrichTenderWithCompanyScore<T extends TenderMatch>(
  tender: T,
  companyId: string,
  companyCategories: string[],
  options?: { profile?: CompanyComplianceProfile },
): Promise<T> {
  if (tender.isScraped) {
    const profile =
      options?.profile ?? generateComplianceProfile(companyId, await listDocumentsForCompany(companyId));
    const requirements = buildTenderRequirementsFromTender(tender);
    const score = calculateTenderMatchScore(companyId, tender.id, tender.title, profile, requirements);
    const categoryHit = categoryMatches(tender.category, companyCategories, tenderMatchText(tender));
    const hasGaps = score.missingDocuments.length > 0;
    const readinessScore = applyReadinessBonus(score.matchScore, hasGaps, categoryHit);
    const scoreBreakdown: TenderReadinessScoreBreakdown = {
      documentCompleteness: Math.round(score.breakdown.documentCompleteness * 0.3),
      verificationCoverage: Math.round(score.breakdown.verificationStatus * 0.25),
      csdProfileCompleteness: Math.round(score.breakdown.requirementMatch * 0.2),
      complianceConsistency: Math.round(score.breakdown.documentValidity * 0.15),
      tenderFitBonus: categoryHit ? CATEGORY_BONUS : Math.round(score.breakdown.bonusPoints),
    };

    return {
      ...tender,
      matchScore: readinessScore,
      readinessScore,
      scoreBreakdown,
      isBidReady: !hasGaps && readinessScore >= 100,
      gaps: score.gaps.map((gap) => gap.recommendation),
      recommendationReason: categoryHit
        ? `${score.recommendation} Category match: ${tender.category}.`
        : score.recommendation,
    };
  }

  // Stored tender — use the full Tender Readiness Score™ engine.
  const readiness = await getTenderReadiness(tender.id, companyId);
  if (!readiness) return tender;

  return {
    ...tender,
    matchScore: readiness.readinessScore,
    readinessScore: readiness.readinessScore,
    scoreBreakdown: readiness.scoreBreakdown,
    isBidReady: readiness.isBidReady ?? readiness.readyToSubmit ?? false,
    gaps: readiness.gaps,
  };
}

/**
 * The company-aware fit number for a single tender, without mutating the tender.
 * Used by the AI advisor so its "tender match score" agrees with the badge the
 * user clicked on.
 */
export function tenderFitScore(input: {
  matchScore: number;
  hasGaps: boolean;
  tenderCategory: string;
  companyCategories: string[];
  tenderText?: string;
}): number {
  const categoryHit = categoryMatches(input.tenderCategory, input.companyCategories, input.tenderText ?? '');
  return applyReadinessBonus(input.matchScore, input.hasGaps, categoryHit);
}
