/**
 * AI Compliance Scoring Service
 * Analyzes company compliance documents against tender requirements.
 * Follows government-class standards for fair, transparent scoring.
 * 
 * Scoring Methodology:
 * - Document completeness (25%)
 * - Document validity/expiry (25%)
 * - Requirement matching (30%)
 * - Verification status (20%)
 */

import type { InternalDocument } from './mockData';
import type { DocumentAnalysis } from './pdfExtractor';
import { DOCUMENT_CATEGORY_GROUPS } from '@/lib/api/types';
import type { DocumentCategory } from '@/lib/api/types';
import { getScmSectorForText } from '@/lib/scmIntelligence';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompanyComplianceProfile {
  companyId: string;
  documents: DocumentWithAnalysis[];
  overallScore: number;
  documentCount: number;
  categoryScores: CategoryScores;
  missingCategories: string[];
  expiringDocuments: ExpiringDocument[];
  recommendations: string[];
  lastCalculated: string;
}

export interface DocumentWithAnalysis extends InternalDocument {
  analysis?: DocumentAnalysis;
}

export interface CategoryScores {
  tax: CategoryScore;
  bbbee: CategoryScore;
  registration: CategoryScore;
  legal: CategoryScore;
  financial: CategoryScore;
  certification: CategoryScore;
  policy?: CategoryScore;
  [key: string]: CategoryScore | undefined;
}

export interface CategoryScore {
  score: number;
  hasDocument: boolean;
  isVerified: boolean;
  isExpired: boolean;
  expiresInDays: number | null;
  documentCount: number;
}

export interface ExpiringDocument {
  documentId: string;
  documentName: string;
  category: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

export interface TenderMatchScore {
  tenderId: string;
  tenderTitle: string;
  companyId: string;
  matchScore: number;
  breakdown: TenderScoreBreakdown;
  gaps: ComplianceGap[];
  recommendations: string[];
  missingDocuments: string[];
  strengths: string[];
  recommendation: string;
  confidenceScore: number;
  priorityActions: PriorityAction[];
  evidence: RequirementEvidence[];
  isEligible: boolean;
  calculatedAt: string;
}

export interface TenderScoreBreakdown {
  documentCompleteness: number;
  documentValidity: number;
  requirementMatch: number;
  verificationStatus: number;
  bonusPoints: number;
}

export interface ComplianceGap {
  category: string;
  requirement: string;
  severity: 'critical' | 'major' | 'minor';
  recommendation: string;
}

export interface RequirementEvidence {
  category: string;
  requirement: string;
  matched: boolean;
  valid: boolean;
  verified: boolean;
  documentId: string | null;
  documentName: string | null;
  documentStatus: string | null;
  expiryDate: string | null;
  reason: string;
}

export interface PriorityAction {
  title: string;
  severity: 'critical' | 'major' | 'minor';
  etaDays: number;
  reason: string;
}

export interface TenderRequirements {
  requiredCategories: string[];
  preferredCategories: string[];
  minBBBEELevel?: number;
  minCIDBGrade?: string;
  requiredCertifications?: string[];
  requiresCsd?: boolean;
  minCompanyAge?: number;
  minAnnualTurnover?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_WEIGHTS: Record<string, number> = {
  tax: 0.25,
  registration: 0.20,
  bbbee: 0.20,
  legal: 0.10,
  financial: 0.15,
  certification: 0.10,
};

/**
 * Tender Readiness Score™ Dimension Weights
 * As per Section 4.4 scoring specification:
 * - Document Completeness: 30pts (valid docs ÷ expected for sector × 30)
 * - Verification Coverage: 25pts (verified ÷ uploaded × 25)
 * - CSD Profile Completeness: 20pts (from company profile fields)
 * - Compliance Consistency: 15pts (renewal history: 0/1/2+ expired in 12mo)
 * - Remaining 10pts reserved for tender-specific relevance bonus
 */
const TENDER_READINESS_WEIGHTS = {
  documentCompleteness: 30,
  verificationCoverage: 25,
  csdProfileCompleteness: 20,
  complianceConsistency: 15,
  tenderFitBonus: 10,
};

// Legacy weights kept for backward compatibility during transition
const TENDER_SCORE_WEIGHTS = {
  documentCompleteness: 0.25,
  documentValidity: 0.25,
  requirementMatch: 0.30,
  verificationStatus: 0.20,
};

const EXPIRY_WARNING_DAYS = 30;
const EXPIRY_CRITICAL_DAYS = 7;

function complianceGroup(category: string): string {
  return DOCUMENT_CATEGORY_GROUPS[category as DocumentCategory] ?? category;
}

function documentMatchesExpectedType(doc: DocumentWithAnalysis, expectedType: string): boolean {
  const expected = expectedType.toLowerCase().trim();
  const category = doc.category.toLowerCase();
  const group = complianceGroup(doc.category);
  const text = documentEvidenceText(doc);

  if (expected === 'cidb') {
    return category === 'cidb_certificate' || /\bcidb\b|contractor grading|grading designation/.test(text);
  }
  if (expected === 'nhbrc') {
    return category === 'nhbrc_certificate' || /\bnhbrc\b/.test(text);
  }
  if (expected.startsWith('iso')) {
    return category === 'iso_certificate' || text.includes(expected.replace(/\s+/g, ' '));
  }

  return group === complianceGroup(expected);
}

/**
 * Sector-based expected document categories
 * Used by Document Completeness scoring to determine expected doc count per sector
 */
export const SECTOR_DOCUMENT_REQUIREMENTS: Record<string, string[]> = {
  construction: ['tax', 'bbbee', 'registration', 'cidb', 'financial', 'legal'],
  it: ['tax', 'bbbee', 'registration', 'financial'],
  consulting: ['tax', 'bbbee', 'registration', 'financial', 'legal'],
  manufacturing: ['tax', 'bbbee', 'registration', 'financial', 'certification'],
  logistics: ['tax', 'bbbee', 'registration', 'financial', 'legal'],
  healthcare: ['tax', 'bbbee', 'registration', 'financial', 'certification', 'legal'],
  default: ['tax', 'bbbee', 'registration', 'financial'],
};

/**
 * Get expected document categories for a company sector
 */
export function getExpectedDocumentsForSector(sector?: string): string[] {
  const normalized = (sector ?? '').toLowerCase().trim();
  const scmSector = getScmSectorForText(normalized);
  return SECTOR_DOCUMENT_REQUIREMENTS[normalized] ?? scmSector?.expectedDocumentGroups ?? SECTOR_DOCUMENT_REQUIREMENTS.default;
}

// ─── Scoring Functions ────────────────────────────────────────────────────────

/**
 * Calculate days until a date expires (negative if already expired)
 */
function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate score for a single category
 */
function calculateCategoryScore(documents: DocumentWithAnalysis[], category: string): CategoryScore {
  const categoryDocs = documents.filter(d => complianceGroup(d.category) === category);
  const hasDocument = categoryDocs.length > 0;
  const verifiedDocs = categoryDocs.filter(d => d.status === 'verified');
  const isVerified = verifiedDocs.length > 0;
  
  // Check for expiration
  let isExpired = false;
  let nearestExpiry: number | null = null;
  
  for (const doc of categoryDocs) {
    const days = daysUntilExpiry(doc.expiryDate);
    if (days !== null) {
      if (days < 0) {
        isExpired = true;
      }
      if (nearestExpiry === null || days < nearestExpiry) {
        nearestExpiry = days;
      }
    }
  }
  
  // Calculate score
  let score = 0;
  if (hasDocument) {
    score += 40; // Base score for having document
  }
  if (isVerified) {
    score += 30; // Bonus for verification
  }
  if (!isExpired && hasDocument) {
    score += 20; // Document is valid
  }
  if (nearestExpiry !== null && nearestExpiry > EXPIRY_WARNING_DAYS) {
    score += 10; // Not expiring soon
  }
  
  return {
    score: Math.min(score, 100),
    hasDocument,
    isVerified,
    isExpired,
    expiresInDays: nearestExpiry,
    documentCount: categoryDocs.length,
  };
}

/**
 * Generate compliance profile for a company
 */
export function generateComplianceProfile(
  companyId: string,
  documents: DocumentWithAnalysis[]
): CompanyComplianceProfile {
  const categoryScores: CategoryScores = {
    tax: calculateCategoryScore(documents, 'tax'),
    bbbee: calculateCategoryScore(documents, 'bbbee'),
    registration: calculateCategoryScore(documents, 'registration'),
    legal: calculateCategoryScore(documents, 'legal'),
    financial: calculateCategoryScore(documents, 'financial'),
    certification: calculateCategoryScore(documents, 'certification'),
  };
  
  // Calculate overall score
  let overallScore = 0;
  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const catScore = categoryScores[category as keyof CategoryScores];
    if (catScore) {
      overallScore += catScore.score * weight;
    }
  }
  
  // Find missing categories
  const missingCategories = Object.entries(categoryScores)
    .filter(([, score]) => score && !score.hasDocument)
    .map(([category]) => category);
  
  // Find expiring documents
  const expiringDocuments: ExpiringDocument[] = [];
  for (const doc of documents) {
    const days = daysUntilExpiry(doc.expiryDate);
    if (days !== null && days >= 0 && days <= EXPIRY_WARNING_DAYS) {
      expiringDocuments.push({
        documentId: doc.id,
        documentName: doc.name,
        category: doc.category,
        expiryDate: doc.expiryDate!,
        daysUntilExpiry: days,
      });
    }
  }
  expiringDocuments.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (missingCategories.length > 0) {
    recommendations.push(`Upload missing documents: ${missingCategories.join(', ')}`);
  }
  for (const exp of expiringDocuments.filter(e => e.daysUntilExpiry <= EXPIRY_CRITICAL_DAYS)) {
    recommendations.push(`URGENT: ${exp.documentName} expires in ${exp.daysUntilExpiry} days`);
  }
  const unverifiedCount = documents.filter(d => d.status === 'uploaded').length;
  if (unverifiedCount > 0) {
    recommendations.push(`Request verification for ${unverifiedCount} uploaded document(s)`);
  }
  
  return {
    companyId,
    documents,
    overallScore: Math.round(overallScore),
    documentCount: documents.length,
    categoryScores,
    missingCategories,
    expiringDocuments,
    recommendations,
    lastCalculated: new Date().toISOString(),
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function buildStrengths(profile: CompanyComplianceProfile, requirements: TenderRequirements): string[] {
  const strengths: string[] = [];

  for (const category of requirements.requiredCategories) {
    const score = profile.categoryScores[category as keyof CategoryScores];
    if (!score?.hasDocument) continue;

    if (score.isVerified && !score.isExpired) {
      strengths.push(`${category.toUpperCase()} documents are verified and valid`);
      continue;
    }

    if (score.hasDocument && !score.isExpired) {
      strengths.push(`${category.toUpperCase()} documents are available`);
    }
  }

  if (profile.expiringDocuments.length === 0) {
    strengths.push('No uploaded documents are currently in the expiry warning window');
  }

  return uniqueStrings(strengths).slice(0, 6);
}

function buildPriorityActions(
  gaps: ComplianceGap[],
  profile: CompanyComplianceProfile,
  requirements: TenderRequirements
): PriorityAction[] {
  const actions: PriorityAction[] = [];
  const severityEta: Record<ComplianceGap['severity'], number> = {
    critical: 7,
    major: 14,
    minor: 30,
  };

  const seen = new Set<string>();
  for (const gap of gaps) {
    const key = `${gap.category}:${gap.requirement}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push({
      title: gap.recommendation,
      severity: gap.severity,
      etaDays: severityEta[gap.severity],
      reason: gap.requirement,
    });
  }

  for (const category of requirements.requiredCategories) {
    const catScore = profile.categoryScores[category as keyof CategoryScores];
    if (!catScore?.hasDocument || catScore.isVerified) continue;
    actions.push({
      title: `Request verification for ${category.toUpperCase()} documentation`,
      severity: 'major',
      etaDays: 5,
      reason: `${category.toUpperCase()} exists but is not verified`,
    });
  }

  return actions
    .sort((a, b) => {
      const rank: Record<PriorityAction['severity'], number> = { critical: 0, major: 1, minor: 2 };
      const severityCompare = rank[a.severity] - rank[b.severity];
      return severityCompare !== 0 ? severityCompare : a.etaDays - b.etaDays;
    })
    .slice(0, 8);
}

function calculateConfidenceScore(profile: CompanyComplianceProfile, requirements: TenderRequirements): number {
  const requiredCategories = requirements.requiredCategories.length > 0
    ? requirements.requiredCategories
    : ['tax', 'registration'];

  let withDocuments = 0;
  let verified = 0;
  let unexpired = 0;

  for (const category of requiredCategories) {
    const score = profile.categoryScores[category as keyof CategoryScores];
    if (!score) continue;
    if (score.hasDocument) withDocuments += 1;
    if (score.isVerified) verified += 1;
    if (score.hasDocument && !score.isExpired) unexpired += 1;
  }

  const denominator = Math.max(requiredCategories.length, 1);
  const coverage = withDocuments / denominator;
  const verification = verified / denominator;
  const validity = unexpired / denominator;

  // Weighted confidence from available, verified, and currently valid required evidence.
  const confidence = coverage * 0.45 + verification * 0.35 + validity * 0.20;
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}

function pickPrimaryRecommendation(
  isEligible: boolean,
  priorityActions: PriorityAction[],
  recommendations: string[]
): string {
  if (priorityActions.length > 0) {
    return priorityActions[0].title;
  }
  if (recommendations.length > 0) {
    return recommendations[0];
  }
  return isEligible
    ? 'Proceed with bid preparation and keep all critical documents current'
    : 'Improve critical compliance gaps before submitting this tender';
}

/**
 * Calculate tender match score for a company
 */
function normalizeEvidenceText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function documentEvidenceText(doc: DocumentWithAnalysis): string {
  const analysis = doc.documentAnalysis ?? doc.analysis;
  const csd = analysis?.csdSupplierSummary;
  return normalizeEvidenceText([
    doc.name,
    doc.category,
    doc.status,
    doc.extractedText,
    doc.aiSummary,
    doc.analysis?.extractedText,
    analysis?.documentType,
    ...(analysis?.keywords ?? []),
    csd?.supplierNumber,
    csd?.legalName,
    csd?.registrationNumber,
    csd?.taxNumber,
    csd?.vatNumber,
    csd?.bbbeeLevel,
    csd?.cidbGrade,
    csd?.taxCompliant === true ? 'tax compliant' : csd?.taxCompliant === false ? 'tax not compliant' : '',
    csd?.active === true ? 'active supplier' : csd?.active === false ? 'inactive supplier' : '',
  ].filter(Boolean).join(' '));
}

function parseLevel(value: string | null | undefined): number | null {
  const match = (value ?? '').match(/(?:level\s*)?([1-8])\b/i);
  if (!match) return null;
  const level = Number(match[1]);
  return Number.isFinite(level) ? level : null;
}

function parseGrade(value: string | null | undefined): number | null {
  const match = (value ?? '').match(/(?:cidb\s*)?(?:grade|grading)?\s*([1-9])\b/i);
  if (!match) return null;
  const grade = Number(match[1]);
  return Number.isFinite(grade) ? grade : null;
}

function isDocumentCurrent(doc: DocumentWithAnalysis): boolean {
  const days = daysUntilExpiry(doc.expiryDate);
  return days === null || days >= 0;
}

function bestDocumentForCategory(documents: DocumentWithAnalysis[], category: string): DocumentWithAnalysis | null {
  const grouped = documents.filter((doc) => complianceGroup(doc.category) === category);
  if (grouped.length === 0) return null;
  return grouped.sort((a, b) => {
    const score = (doc: DocumentWithAnalysis) =>
      (isDocumentCurrent(doc) ? 100 : 0) +
      (doc.status === 'verified' ? 20 : 0) +
      ((doc.documentAnalysis ?? doc.analysis) ? 5 : 0);
    return score(b) - score(a);
  })[0];
}

function docHasCsdEvidence(doc: DocumentWithAnalysis): boolean {
  const analysis = doc.documentAnalysis ?? doc.analysis;
  const text = documentEvidenceText(doc);
  return Boolean(
    analysis?.csdSupplierSummary?.isCsdSupplierSummary ||
    /\b(csd|central supplier database|supplier number|maaa\d{6,})\b/i.test(text)
  );
}

function docHasCidbEvidence(doc: DocumentWithAnalysis): boolean {
  const text = documentEvidenceText(doc);
  return /\b(cidb|construction industry development board|contractor grading|contractor registration)\b/i.test(text);
}

function docHasBbbeeEvidence(doc: DocumentWithAnalysis): boolean {
  const analysis = doc.documentAnalysis ?? doc.analysis;
  const text = documentEvidenceText(doc);
  return Boolean(
    analysis?.csdSupplierSummary?.bbbeeLevel ||
    analysis?.hasBBBEELevel ||
    /\b(b-bbee|bbbee|bee certificate|sworn affidavit|black economic empowerment)\b/i.test(text)
  );
}

function documentMeetsSpecificRequirement(doc: DocumentWithAnalysis, category: string, requirements: TenderRequirements): { ok: boolean; reason: string } {
  const analysis = doc.documentAnalysis ?? doc.analysis;
  const text = documentEvidenceText(doc);

  if (category === 'registration' && requirements.requiresCsd && !docHasCsdEvidence(doc)) {
    return { ok: false, reason: 'Uploaded registration document does not prove CSD supplier registration.' };
  }

  if (category === 'bbbee') {
    if (!docHasBbbeeEvidence(doc)) {
      return { ok: false, reason: 'Uploaded B-BBEE document could not be confirmed from its extracted text.' };
    }
    if (requirements.minBBBEELevel) {
      const level = parseLevel(analysis?.csdSupplierSummary?.bbbeeLevel) ?? parseLevel(text);
      if (level === null) return { ok: false, reason: `B-BBEE level ${requirements.minBBBEELevel} or better is required, but no level was found in the uploaded document.` };
      if (level > requirements.minBBBEELevel) return { ok: false, reason: `B-BBEE level ${level} does not meet required level ${requirements.minBBBEELevel} or better.` };
    }
  }

  if (category === 'certification') {
    if (requirements.minCIDBGrade) {
      if (!docHasCidbEvidence(doc)) return { ok: false, reason: 'Tender requires CIDB evidence, but the uploaded certification does not appear to be a CIDB document.' };
      const requiredGrade = parseGrade(requirements.minCIDBGrade);
      const actualGrade = parseGrade(analysis?.csdSupplierSummary?.cidbGrade) ?? parseGrade(text);
      if (requiredGrade !== null && actualGrade === null) return { ok: false, reason: `CIDB grade ${requiredGrade} or higher is required, but no grade was found in the uploaded document.` };
      if (requiredGrade !== null && actualGrade !== null && actualGrade < requiredGrade) return { ok: false, reason: `CIDB grade ${actualGrade} is below required grade ${requiredGrade}.` };
    }

    if (requirements.requiredCertifications?.length) {
      const missing = requirements.requiredCertifications.filter((cert) => !text.includes(normalizeEvidenceText(cert)));
      if (missing.length === requirements.requiredCertifications.length) {
        return { ok: false, reason: `Uploaded certification does not show required certification evidence: ${requirements.requiredCertifications.join(', ')}.` };
      }
    }
  }

  return { ok: true, reason: 'Uploaded document evidence supports this requirement.' };
}

function evaluateRequirementEvidence(profile: CompanyComplianceProfile, category: string, requirements: TenderRequirements): RequirementEvidence {
  const doc = bestDocumentForCategory(profile.documents, category);
  const requirement = `${category.toUpperCase()} evidence required`;

  if (!doc) {
    return {
      category,
      requirement,
      matched: false,
      valid: false,
      verified: false,
      documentId: null,
      documentName: null,
      documentStatus: null,
      expiryDate: null,
      reason: `No uploaded ${category.toUpperCase()} document was found for this company.`,
    };
  }

  const valid = isDocumentCurrent(doc);
  if (!valid) {
    return {
      category,
      requirement,
      matched: true,
      valid: false,
      verified: doc.status === 'verified',
      documentId: doc.id,
      documentName: doc.name,
      documentStatus: doc.status,
      expiryDate: doc.expiryDate,
      reason: `${doc.name} is uploaded but expired.`,
    };
  }

  const specific = documentMeetsSpecificRequirement(doc, category, requirements);
  return {
    category,
    requirement,
    matched: specific.ok,
    valid,
    verified: doc.status === 'verified',
    documentId: doc.id,
    documentName: doc.name,
    documentStatus: doc.status,
    expiryDate: doc.expiryDate,
    reason: specific.ok ? `${doc.name} supports ${category.toUpperCase()} requirement.` : specific.reason,
  };
}
export function calculateTenderMatchScore(
  companyId: string,
  tenderId: string,
  tenderTitle: string,
  profile: CompanyComplianceProfile,
  requirements: TenderRequirements
): TenderMatchScore {
  const normalizedRequired = uniqueStrings(
    (requirements.requiredCategories.length > 0 ? requirements.requiredCategories : ['tax', 'registration'])
      .map(complianceGroup)
  );
  const normalizedPreferred = uniqueStrings(requirements.preferredCategories.map(complianceGroup));
  const evidence = normalizedRequired.map((category) => evaluateRequirementEvidence(profile, category, requirements));
  const gaps: ComplianceGap[] = [];
  const recommendations: string[] = [];

  for (const item of evidence) {
    if (!item.documentId) {
      gaps.push({
        category: item.category,
        requirement: item.requirement,
        severity: 'critical',
        recommendation: `Upload a valid ${item.category.toUpperCase()} document`,
      });
      continue;
    }

    if (!item.valid) {
      gaps.push({
        category: item.category,
        requirement: `Current ${item.category.toUpperCase()} document`,
        severity: 'critical',
        recommendation: `Renew ${item.documentName ?? item.category} before bidding`,
      });
      continue;
    }

    if (!item.matched) {
      gaps.push({
        category: item.category,
        requirement: item.requirement,
        severity: 'critical',
        recommendation: item.reason,
      });
      continue;
    }

    if (!item.verified) {
      recommendations.push(`Request verification for ${item.documentName ?? item.category}`);
    }
  }

  for (const doc of profile.expiringDocuments) {
    if (normalizedRequired.includes(complianceGroup(doc.category))) {
      recommendations.push(`${doc.documentName} expires in ${doc.daysUntilExpiry} days`);
    }
  }

  const denominator = Math.max(evidence.length, 1);
  const presentCount = evidence.filter((item) => item.documentId).length;
  const matchedCount = evidence.filter((item) => item.documentId && item.matched).length;
  const validCount = evidence.filter((item) => item.documentId && item.valid).length;
  const verifiedCount = evidence.filter((item) => item.documentId && item.matched && item.valid && item.verified).length;

  const completenessScore = Math.round((presentCount / denominator) * 100);
  const validityScore = Math.round((validCount / denominator) * 100);
  const requirementScore = Math.round((matchedCount / denominator) * 100);
  const verificationScore = Math.round((verifiedCount / denominator) * 100);

  let bonusPoints = 0;
  for (const preferred of normalizedPreferred) {
    const preferredDoc = evaluateRequirementEvidence(profile, preferred, requirements);
    if (preferredDoc.documentId && preferredDoc.valid && preferredDoc.verified && preferredDoc.matched) {
      bonusPoints += 5;
    }
  }

  const breakdown: TenderScoreBreakdown = {
    documentCompleteness: completenessScore,
    documentValidity: validityScore,
    requirementMatch: requirementScore,
    verificationStatus: verificationScore,
    bonusPoints: Math.min(bonusPoints, 10),
  };

  const matchScore = Math.min(100, Math.round(
    breakdown.documentCompleteness * TENDER_SCORE_WEIGHTS.documentCompleteness +
    breakdown.documentValidity * TENDER_SCORE_WEIGHTS.documentValidity +
    breakdown.requirementMatch * TENDER_SCORE_WEIGHTS.requirementMatch +
    breakdown.verificationStatus * TENDER_SCORE_WEIGHTS.verificationStatus +
    breakdown.bonusPoints
  ));

  const hasCriticalGaps = gaps.some(g => g.severity === 'critical');
  const missingDocuments = uniqueStrings(
    evidence
      .filter((item) => !item.documentId || !item.matched || !item.valid)
      .map((item) => item.category)
  );
  const adjustedMatchScore = missingDocuments.length > 0 ? Math.min(matchScore, 99) : matchScore;
  const isEligible = !hasCriticalGaps && adjustedMatchScore >= 50;
  const normalizedRequirements = { ...requirements, requiredCategories: normalizedRequired, preferredCategories: normalizedPreferred };
  const strengths = buildStrengths(profile, normalizedRequirements);
  const priorityActions = buildPriorityActions(gaps, profile, normalizedRequirements);
  const confidenceScore = calculateConfidenceScore(profile, normalizedRequirements);
  const recommendation = pickPrimaryRecommendation(isEligible, priorityActions, recommendations);

  return {
    tenderId,
    tenderTitle,
    companyId,
    matchScore: adjustedMatchScore,
    breakdown,
    gaps,
    recommendations,
    missingDocuments,
    strengths,
    recommendation,
    confidenceScore,
    priorityActions,
    evidence,
    isEligible,
    calculatedAt: new Date().toISOString(),
  };
}
/**
 * Generate human-readable compliance report
 */
export function generateComplianceReport(profile: CompanyComplianceProfile): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════',
    '           COMPANY COMPLIANCE REPORT',
    '═══════════════════════════════════════════════════════',
    '',
    `Company ID: ${profile.companyId}`,
    `Report Generated: ${new Date(profile.lastCalculated).toLocaleString()}`,
    '',
    `OVERALL COMPLIANCE SCORE: ${profile.overallScore}/100`,
    '',
    '─── Category Breakdown ───',
  ];
  
  for (const [category, score] of Object.entries(profile.categoryScores)) {
    if (!score) continue;
    const status = score.hasDocument
      ? score.isVerified
        ? '✓ Verified'
        : score.isExpired
          ? '✗ Expired'
          : '⏳ Pending'
      : '✗ Missing';
    lines.push(`  ${category.toUpperCase().padEnd(15)} ${score.score.toString().padStart(3)}/100  ${status}`);
  }
  
  if (profile.recommendations.length > 0) {
    lines.push('', '─── Recommendations ───');
    for (const rec of profile.recommendations) {
      lines.push(`  • ${rec}`);
    }
  }
  
  lines.push('', '═══════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

// ─── Tender Readiness Score™ ──────────────────────────────────────────────────

export interface TenderReadinessScore {
  totalScore: number;
  dimensions: {
    documentCompleteness: number;
    verificationCoverage: number;
    csdProfileCompleteness: number;
    complianceConsistency: number;
    tenderFitBonus: number;
  };
  breakdown: {
    validDocuments: number;
    expectedDocuments: number;
    verifiedDocuments: number;
    uploadedDocuments: number;
    csdFieldsComplete: number;
    csdFieldsTotal: number;
    csdCompletenessScore: number;
    csdCompletenessSource: 'supplier_summary' | 'profile_fields';
    expiredInPast12Months: number;
  };
  isBidReady: boolean;
  missingForBidReady: string[];
  calculatedAt: string;
}

export interface CompanyProfileFields {
  name?: string;
  registrationNumber?: string;
  vatNumber?: string;
  industry?: string;
  province?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  yearEstablished?: number;
  annualTurnover?: string;
  employeeCount?: number;
  bbbeeLevel?: number;
  cidbGrade?: string;
}

/**
 * Count CSD profile field completeness
 */
function calculateCsdCompleteness(profile: CompanyProfileFields): { complete: number; total: number } {
  const fields: (keyof CompanyProfileFields)[] = [
    'name',
    'registrationNumber',
    'vatNumber',
    'industry',
    'province',
    'address',
    'contactEmail',
    'contactPhone',
  ];
  
  let complete = 0;
  for (const field of fields) {
    const value = profile[field];
    if (value !== undefined && value !== null && value !== '') {
      complete++;
    }
  }
  
  return { complete, total: fields.length };
}

function getBestCsdSupplierSummary(documents: DocumentWithAnalysis[]): DocumentAnalysis['csdSupplierSummary'] | null {
  const summaries = documents
    .map(doc => doc.documentAnalysis?.csdSupplierSummary ?? doc.analysis?.csdSupplierSummary)
    .filter((summary): summary is NonNullable<DocumentAnalysis['csdSupplierSummary']> => Boolean(summary?.isCsdSupplierSummary));

  if (summaries.length === 0) return null;
  return summaries.sort((a, b) => b.completenessScore - a.completenessScore)[0];
}

/**
 * Calculate Compliance Consistency score based on renewal history
 * - No expired documents in past 12 months = 15pts
 * - One expired = 10pts
 * - Two or more = 5pts
 * - New accounts start at 10pts
 */
function calculateComplianceConsistency(expiredInPast12Months: number, isNewAccount: boolean): number {
  if (isNewAccount) return 10;
  if (expiredInPast12Months === 0) return 15;
  if (expiredInPast12Months === 1) return 10;
  return 5;
}

/**
 * Calculate Tender Readiness Score™ per Section 4.4 specification
 * 
 * @param companyId - Company identifier
 * @param documents - All company documents
 * @param companyProfile - CSD profile fields for completeness check
 * @param sector - Company sector for expected document calculation
 * @param expiredInPast12Months - Count of documents that expired in past 12 months
 * @param isNewAccount - Whether account is less than 12 months old
 * @param tenderRequirements - Optional tender-specific requirements for fit bonus
 */
export function calculateTenderReadinessScore(
  companyId: string,
  documents: DocumentWithAnalysis[],
  companyProfile: CompanyProfileFields,
  sector?: string,
  expiredInPast12Months = 0,
  isNewAccount = false,
  tenderRequirements?: TenderRequirements
): TenderReadinessScore {
  const expectedCategories = getExpectedDocumentsForSector(sector);
  const expectedCount = expectedCategories.length;
  
  // 1. Document Completeness (30pts)
  // Valid (non-expired, uploaded) docs ÷ expected for sector × 30
  const validDocs = documents.filter(doc => {
    const days = daysUntilExpiry(doc.expiryDate);
    return days === null || days >= 0;
  });
  const validExpectedTypes = expectedCategories.filter(expected =>
    validDocs.some(doc => documentMatchesExpectedType(doc, expected))
  );
  const validDocCategories = new Set(validDocs.map(d => complianceGroup(d.category)));
  const validDocCount = validExpectedTypes.length;
  const documentCompletenessScore = Math.round((validDocCount / Math.max(expectedCount, 1)) * TENDER_READINESS_WEIGHTS.documentCompleteness);
  
  // 2. Verification Coverage (25pts)
  // Verified ÷ uploaded × 25
  const uploadedCount = documents.length;
  const verifiedCount = documents.filter(doc => doc.status === 'verified').length;
  const verificationCoverageScore = uploadedCount > 0
    ? Math.round((verifiedCount / uploadedCount) * TENDER_READINESS_WEIGHTS.verificationCoverage)
    : 0;
  
  // 3. CSD Profile Completeness (20pts)
  const profileCsdCompletion = calculateCsdCompleteness(companyProfile);
  const supplierSummary = getBestCsdSupplierSummary(documents);
  const csdCompletion = supplierSummary
    ? { complete: supplierSummary.fieldsComplete, total: supplierSummary.fieldsTotal }
    : profileCsdCompletion;
  const csdCompletenessPercent = supplierSummary
    ? supplierSummary.completenessScore
    : Math.round((profileCsdCompletion.complete / profileCsdCompletion.total) * 100);
  const csdProfileCompletenessScore = Math.round((csdCompletenessPercent / 100) * TENDER_READINESS_WEIGHTS.csdProfileCompleteness);
  
  // 4. Compliance Consistency (15pts)
  const complianceConsistencyScore = calculateComplianceConsistency(expiredInPast12Months, isNewAccount);
  
  // Tender fit is awarded only when this tender has requirements to match.
  let tenderFitBonusScore = 0;
  if (tenderRequirements) {
    const requiredCategories = tenderRequirements.requiredCategories.map(complianceGroup);
    if (requiredCategories.length > 0) {
      const matchedRequired = requiredCategories.filter(cat => validDocCategories.has(cat)).length;
      tenderFitBonusScore = Math.round((matchedRequired / requiredCategories.length) * TENDER_READINESS_WEIGHTS.tenderFitBonus);
    }
  }
  
  const totalScore = documentCompletenessScore + verificationCoverageScore + csdProfileCompletenessScore + complianceConsistencyScore + tenderFitBonusScore;
  
  // Determine bid-ready status (100% = all expected docs valid + verified)
  const missingForBidReady: string[] = [];
  for (const category of expectedCategories) {
    const doc = documents.find(d => documentMatchesExpectedType(d, category));
    if (!doc) {
      missingForBidReady.push(`Missing ${category.toUpperCase()} document`);
    } else if (doc.status !== 'verified') {
      missingForBidReady.push(`${category.toUpperCase()} document not verified`);
    } else {
      const days = daysUntilExpiry(doc.expiryDate);
      if (days !== null && days < 0) {
        missingForBidReady.push(`${category.toUpperCase()} document expired`);
      }
    }
  }
  
  const isBidReady = missingForBidReady.length === 0;
  
  return {
    totalScore,
    dimensions: {
      documentCompleteness: documentCompletenessScore,
      verificationCoverage: verificationCoverageScore,
      csdProfileCompleteness: csdProfileCompletenessScore,
      complianceConsistency: complianceConsistencyScore,
      tenderFitBonus: tenderFitBonusScore,
    },
    breakdown: {
      validDocuments: validDocCount,
      expectedDocuments: expectedCount,
      verifiedDocuments: verifiedCount,
      uploadedDocuments: uploadedCount,
      csdFieldsComplete: csdCompletion.complete,
      csdFieldsTotal: csdCompletion.total,
      csdCompletenessScore: csdCompletenessPercent,
      csdCompletenessSource: supplierSummary ? 'supplier_summary' : 'profile_fields',
      expiredInPast12Months,
    },
    isBidReady,
    missingForBidReady,
    calculatedAt: new Date().toISOString(),
  };
}
