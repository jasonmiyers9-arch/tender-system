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
import type { DocumentCategory } from '@/lib/api/types';

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
  documentCompleteness: 0.30,
  documentValidity: 0.25,
  requirementMatch: 0.30,
  verificationStatus: 0.15,
};

const EXPIRY_WARNING_DAYS = 30;
const EXPIRY_CRITICAL_DAYS = 7;

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
  return SECTOR_DOCUMENT_REQUIREMENTS[normalized] ?? SECTOR_DOCUMENT_REQUIREMENTS.default;
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
  const categoryDocs = documents.filter(d => d.category === category);
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
export function calculateTenderMatchScore(
  companyId: string,
  tenderId: string,
  tenderTitle: string,
  profile: CompanyComplianceProfile,
  requirements: TenderRequirements
): TenderMatchScore {
  const gaps: ComplianceGap[] = [];
  const recommendations: string[] = [];
  
  // 1. Document Completeness (25%)
  let completenessScore = 100;
  for (const required of requirements.requiredCategories) {
    const catScore = profile.categoryScores[required as keyof CategoryScores];
    if (!catScore?.hasDocument) {
      completenessScore -= 100 / requirements.requiredCategories.length;
      gaps.push({
        category: required,
        requirement: `${required.toUpperCase()} document required`,
        severity: 'critical',
        recommendation: `Upload a valid ${required} document`,
      });
    }
  }
  completenessScore = Math.max(0, completenessScore);
  
  // 2. Document Validity (25%)
  let validityScore = 100;
  const requiredCats = new Set(requirements.requiredCategories);
  for (const [category, catScore] of Object.entries(profile.categoryScores)) {
    if (!catScore) continue;
    if (requiredCats.has(category)) {
      if (catScore.isExpired) {
        validityScore -= 100 / requirements.requiredCategories.length;
        gaps.push({
          category,
          requirement: `Valid ${category} document`,
          severity: 'critical',
          recommendation: `Renew your expired ${category} document`,
        });
      } else if (catScore.expiresInDays !== null && catScore.expiresInDays <= EXPIRY_WARNING_DAYS) {
        validityScore -= 10; // Penalty for expiring soon
        recommendations.push(`Your ${category} document expires in ${catScore.expiresInDays} days`);
      }
    }
  }
  validityScore = Math.max(0, validityScore);
  
  // 3. Requirement Matching (30%)
  let requirementScore = 100;
  
  // Check B-BBEE level
  if (requirements.minBBBEELevel) {
    const bbbeeDoc = profile.documents.find(d => d.category === 'bbbee' && d.analysis);
    if (!bbbeeDoc) {
      requirementScore -= 30;
      gaps.push({
        category: 'bbbee',
        requirement: `B-BBEE Level ${requirements.minBBBEELevel} or better`,
        severity: 'critical',
        recommendation: 'Upload your B-BBEE certificate',
      });
    }
    // In a real implementation, we'd check the actual level from the document
  }
  
  // Check CIDB grade
  if (requirements.minCIDBGrade) {
    const cidbDoc = profile.documents.find(d => 
      d.category === 'registration' && 
      d.analysis?.extractedText.toLowerCase().includes('cidb')
    );
    if (!cidbDoc) {
      requirementScore -= 20;
      gaps.push({
        category: 'registration',
        requirement: `CIDB Grade ${requirements.minCIDBGrade} or higher`,
        severity: 'major',
        recommendation: 'Upload your CIDB registration certificate',
      });
    }
  }
  
  // Check preferred categories (bonus, not penalty)
  let bonusPoints = 0;
  for (const preferred of requirements.preferredCategories) {
    const catScore = profile.categoryScores[preferred as keyof CategoryScores];
    if (catScore?.hasDocument && catScore.isVerified) {
      bonusPoints += 5;
    }
  }
  
  requirementScore = Math.max(0, requirementScore);
  
  // 4. Verification Status (20%)
  let verificationScore = 0;
  let verifiedCount = 0;
  let requiredCount = 0;
  
  for (const category of requirements.requiredCategories) {
    const catScore = profile.categoryScores[category as keyof CategoryScores];
    if (catScore?.hasDocument) {
      requiredCount++;
      if (catScore.isVerified) {
        verifiedCount++;
      }
    }
  }
  
  if (requiredCount > 0) {
    verificationScore = (verifiedCount / requiredCount) * 100;
  }
  
  if (verifiedCount < requiredCount) {
    recommendations.push(`${requiredCount - verifiedCount} required document(s) pending verification`);
  }
  
  // Calculate final score
  const breakdown: TenderScoreBreakdown = {
    documentCompleteness: Math.round(completenessScore),
    documentValidity: Math.round(validityScore),
    requirementMatch: Math.round(requirementScore),
    verificationStatus: Math.round(verificationScore),
    bonusPoints: Math.min(bonusPoints, 10),
  };
  
  const matchScore = Math.min(100, Math.round(
    breakdown.documentCompleteness * TENDER_SCORE_WEIGHTS.documentCompleteness +
    breakdown.documentValidity * TENDER_SCORE_WEIGHTS.documentValidity +
    breakdown.requirementMatch * TENDER_SCORE_WEIGHTS.requirementMatch +
    breakdown.verificationStatus * TENDER_SCORE_WEIGHTS.verificationStatus +
    breakdown.bonusPoints
  ));
  
  // Determine eligibility
  const hasCriticalGaps = gaps.some(g => g.severity === 'critical');
  const isEligible = !hasCriticalGaps && matchScore >= 50;

  const missingDocuments = uniqueStrings(
    gaps
      .filter(gap => gap.severity === 'critical')
      .map(gap => gap.category)
  );
  const strengths = buildStrengths(profile, requirements);
  const priorityActions = buildPriorityActions(gaps, profile, requirements);
  const confidenceScore = calculateConfidenceScore(profile, requirements);
  const recommendation = pickPrimaryRecommendation(isEligible, priorityActions, recommendations);
  
  return {
    tenderId,
    tenderTitle,
    companyId,
    matchScore,
    breakdown,
    gaps,
    recommendations,
    missingDocuments,
    strengths,
    recommendation,
    confidenceScore,
    priorityActions,
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
    const isValid = days === null || days >= 0;
    const categoryMatch = expectedCategories.includes(doc.category);
    return isValid && categoryMatch;
  });
  const validDocCategories = new Set(validDocs.map(d => d.category));
  const validDocCount = validDocCategories.size;
  const documentCompletenessScore = Math.round((validDocCount / Math.max(expectedCount, 1)) * TENDER_READINESS_WEIGHTS.documentCompleteness);
  
  // 2. Verification Coverage (25pts)
  // Verified ÷ uploaded × 25
  const uploadedCount = documents.length;
  const verifiedCount = documents.filter(doc => doc.status === 'verified').length;
  const verificationCoverageScore = uploadedCount > 0
    ? Math.round((verifiedCount / uploadedCount) * TENDER_READINESS_WEIGHTS.verificationCoverage)
    : 0;
  
  // 3. CSD Profile Completeness (20pts)
  const csdCompletion = calculateCsdCompleteness(companyProfile);
  const csdProfileCompletenessScore = Math.round((csdCompletion.complete / csdCompletion.total) * TENDER_READINESS_WEIGHTS.csdProfileCompleteness);
  
  // 4. Compliance Consistency (15pts)
  const complianceConsistencyScore = calculateComplianceConsistency(expiredInPast12Months, isNewAccount);
  
  // 5. Tender Fit Bonus (10pts) - optional, based on tender requirements match
  let tenderFitBonusScore = 0;
  if (tenderRequirements) {
    const requiredCategories = tenderRequirements.requiredCategories as DocumentCategory[];
    if (requiredCategories.length > 0) {
      const matchedRequired = requiredCategories.filter(cat => validDocCategories.has(cat)).length;
      tenderFitBonusScore = Math.round((matchedRequired / requiredCategories.length) * TENDER_READINESS_WEIGHTS.tenderFitBonus);
    } else {
      tenderFitBonusScore = TENDER_READINESS_WEIGHTS.tenderFitBonus; // Full bonus if no specific requirements
    }
  }
  
  const totalScore = documentCompletenessScore + verificationCoverageScore + csdProfileCompletenessScore + complianceConsistencyScore + tenderFitBonusScore;
  
  // Determine bid-ready status (100% = all expected docs valid + verified)
  const missingForBidReady: string[] = [];
  for (const category of expectedCategories) {
    const doc = documents.find(d => d.category === category);
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
      expiredInPast12Months,
    },
    isBidReady,
    missingForBidReady,
    calculatedAt: new Date().toISOString(),
  };
}
