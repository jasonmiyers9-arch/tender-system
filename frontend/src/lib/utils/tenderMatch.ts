/**
 * Single definition of how a tender match score maps to a label and badge colour.
 *
 * Every place that renders the "Strong Match / Matched / Low Match" badge must
 * use these helpers so the label can never differ between the matches list, the
 * tender detail page, and the calendar. The score they receive is the unified
 * company-aware match score (equal to the tender readiness score) returned by
 * the API.
 */

export type MatchBadgeVariant = 'success' | 'warning' | 'danger';

export const STRONG_MATCH_THRESHOLD = 85;
export const MATCHED_THRESHOLD = 65;

export function matchLabel(score: number): 'Strong Match' | 'Matched' | 'Low Match' {
  if (score >= STRONG_MATCH_THRESHOLD) return 'Strong Match';
  if (score >= MATCHED_THRESHOLD) return 'Matched';
  return 'Low Match';
}

export function matchBadgeVariant(score: number): MatchBadgeVariant {
  if (score >= STRONG_MATCH_THRESHOLD) return 'success';
  if (score >= MATCHED_THRESHOLD) return 'warning';
  return 'danger';
}
