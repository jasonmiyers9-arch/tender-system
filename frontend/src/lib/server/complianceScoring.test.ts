import { describe, expect, it } from 'vitest';
import { calculateTenderMatchScore, calculateTenderReadinessScore, generateComplianceProfile, type DocumentWithAnalysis } from './complianceScoring';

function doc(overrides: Partial<DocumentWithAnalysis>): DocumentWithAnalysis {
  return {
    id: overrides.id ?? 'doc-1',
    companyId: 'company-1',
    name: overrides.name ?? 'Document.pdf',
    category: overrides.category ?? 'tax_clearance',
    status: overrides.status ?? 'verified',
    fileUrl: null,
    expiryDate: overrides.expiryDate ?? '2099-01-01',
    uploadedAt: '2026-01-01T00:00:00.000Z',
    verifiedAt: overrides.status === 'verified' ? '2026-01-02T00:00:00.000Z' : null,
    verifiedBy: overrides.status === 'verified' ? 'admin' : null,
    ...overrides,
  };
}

describe('evidence-based tender matching', () => {
  it('uses real uploaded document categories and extracted evidence for tender fit', () => {
    const documents = [
      doc({ name: 'SARS PIN.pdf', category: 'sars_pin', extractedText: 'SARS tax compliant pin' }),
      doc({ name: 'CIPC.pdf', category: 'cipc_registration', extractedText: 'company registration certificate' }),
      doc({ name: 'B-BBEE.pdf', category: 'bbbee_certificate', extractedText: 'B-BBEE certificate level 2' }),
      doc({ name: 'CIDB.pdf', category: 'cidb_certificate', extractedText: 'CIDB contractor grading grade 6' }),
    ];
    const profile = generateComplianceProfile('company-1', documents);
    const result = calculateTenderMatchScore('company-1', 'tender-1', 'Construction tender', profile, {
      requiredCategories: ['tax', 'registration', 'bbbee', 'certification'],
      preferredCategories: [],
      minBBBEELevel: 4,
      minCIDBGrade: 'Grade 5',
    });

    expect(result.isEligible).toBe(true);
    expect(result.matchScore).toBe(100);
    expect(result.evidence.every((item) => item.documentName)).toBe(true);
    expect(result.missingDocuments).toEqual([]);
  });

  it('does not count a generic certification as CIDB evidence', () => {
    const documents = [
      doc({ name: 'SARS PIN.pdf', category: 'sars_pin', extractedText: 'SARS tax compliant pin' }),
      doc({ name: 'CIPC.pdf', category: 'cipc_registration', extractedText: 'company registration certificate' }),
      doc({ name: 'ISO.pdf', category: 'iso_certificate', extractedText: 'ISO 9001 quality management certificate' }),
    ];
    const profile = generateComplianceProfile('company-1', documents);
    const result = calculateTenderMatchScore('company-1', 'tender-1', 'CIDB tender', profile, {
      requiredCategories: ['tax', 'registration', 'certification'],
      preferredCategories: [],
      minCIDBGrade: 'Grade 5',
    });

    expect(result.isEligible).toBe(false);
    expect(result.missingDocuments).toContain('certification');
    expect(result.gaps.some((gap) => gap.recommendation.includes('CIDB'))).toBe(true);
  });

  it('never returns 100% when a required tender document is missing', () => {
    const documents = [
      doc({ name: 'SARS PIN.pdf', category: 'sars_pin', extractedText: 'SARS tax compliant pin' }),
      doc({ name: 'CIPC.pdf', category: 'cipc_registration', extractedText: 'company registration certificate' }),
      doc({ name: 'B-BBEE.pdf', category: 'bbbee_certificate', extractedText: 'B-BBEE certificate level 2' }),
    ];
    const profile = generateComplianceProfile('company-1', documents);
    const result = calculateTenderMatchScore('company-1', 'tender-2', 'Construction tender', profile, {
      requiredCategories: ['tax', 'registration', 'bbbee', 'certification'],
      preferredCategories: [],
    });

    expect(result.missingDocuments).toContain('certification');
    expect(result.isEligible).toBe(false);
    expect(result.matchScore).toBeLessThan(100);
  });
});

describe('Tender Readiness Score calculation rules', () => {
  const profile = {
    name: 'Acme Construction',
    registrationNumber: '2020/123456/07',
    vatNumber: '4123456789',
    industry: 'construction',
    province: 'Gauteng',
    address: '1 Main Road',
    contactEmail: 'ops@example.com',
    contactPhone: '0100000000',
  };

  it('expects CIDB for construction but not for IT document completeness', () => {
    const commonDocs = [
      doc({ id: 'tax', category: 'sars_pin' }),
      doc({ id: 'bbbee', category: 'bbbee_certificate' }),
      doc({ id: 'cipc', category: 'cipc_registration' }),
      doc({ id: 'financial', category: 'financial_statements' }),
      doc({ id: 'legal', category: 'public_liability_insurance' }),
    ];

    const constructionWithoutCidb = calculateTenderReadinessScore('company-1', commonDocs, profile, 'construction');
    const constructionWithCidb = calculateTenderReadinessScore(
      'company-1',
      [...commonDocs, doc({ id: 'cidb', category: 'cidb_certificate', extractedText: 'CIDB contractor grading grade 6' })],
      profile,
      'construction'
    );
    const itScore = calculateTenderReadinessScore('company-1', commonDocs, { ...profile, industry: 'it' }, 'it');

    expect(constructionWithoutCidb.dimensions.documentCompleteness).toBe(25);
    expect(constructionWithCidb.dimensions.documentCompleteness).toBe(30);
    expect(itScore.dimensions.documentCompleteness).toBe(30);
  });

  it('scores compliance consistency from renewal history', () => {
    expect(calculateTenderReadinessScore('company-1', [], profile, 'it', 0, false).dimensions.complianceConsistency).toBe(15);
    expect(calculateTenderReadinessScore('company-1', [], profile, 'it', 1, false).dimensions.complianceConsistency).toBe(10);
    expect(calculateTenderReadinessScore('company-1', [], profile, 'it', 2, false).dimensions.complianceConsistency).toBe(5);
    expect(calculateTenderReadinessScore('company-1', [], profile, 'it', 0, true).dimensions.complianceConsistency).toBe(10);
  });
});