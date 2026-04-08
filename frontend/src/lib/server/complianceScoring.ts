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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompanyComplianceProfile {
  companyId: string;
  documents: DocumentWithAnalysis[];
  overallScore: number;
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

const TENDER_SCORE_WEIGHTS = {
  documentCompleteness: 0.25,
  documentValidity: 0.25,
  requirementMatch: 0.30,
  verificationStatus: 0.20,
};

const EXPIRY_WARNING_DAYS = 30;
const EXPIRY_CRITICAL_DAYS = 7;

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
    overallScore += catScore.score * weight;
  }
  
  // Find missing categories
  const missingCategories = Object.entries(categoryScores)
    .filter(([, score]) => !score.hasDocument)
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
    categoryScores,
    missingCategories,
    expiringDocuments,
    recommendations,
    lastCalculated: new Date().toISOString(),
  };
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
  
  return {
    tenderId,
    tenderTitle,
    companyId,
    matchScore,
    breakdown,
    gaps,
    recommendations,
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
