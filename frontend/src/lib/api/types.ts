// ─────────────────────────────────────────────
// Tender Guard Pro — Shared API Types
// ─────────────────────────────────────────────

export type UserRole = 'user' | 'evaluator' | 'admin' | 'super_admin';
export type DocumentStatus = 'uploaded' | 'verified' | 'rejected' | 'expired';
export const DOCUMENT_UPLOAD_CATEGORIES = [
    'tax_clearance',
    'sars_pin',
    'vat_certificate',
    'cipc_registration',
    'company_profile',
    'csd_supplier_summary',
    'director_ids',
    'shareholder_register',
    'bbbee_certificate',
    'bbbee_affidavit',
    'cidb_certificate',
    'nhbrc_certificate',
    'letter_good_standing',
    'coida_certificate',
    'public_liability_insurance',
    'professional_indemnity',
    'financial_statements',
    'bank_statement',
    'bank_confirmation',
    'municipal_account',
    'proof_of_address',
    'lease_agreement',
    'health_safety_plan',
    'quality_management_policy',
    'environmental_policy',
    'iso_certificate',
    'poa_authority',
    'joint_venture_agreement',
    'other_compliance',
] as const;
export type DocumentUploadCategory = typeof DOCUMENT_UPLOAD_CATEGORIES[number];
export type LegacyDocumentCategory =
    | 'tax'
    | 'legal'
    | 'financial'
    | 'certification'
    | 'bbbee'
    | 'registration'
    | 'policy';
export type DocumentCategory = DocumentUploadCategory | LegacyDocumentCategory;

export const DOCUMENT_CATEGORY_GROUPS: Record<DocumentCategory, LegacyDocumentCategory> = {
    tax_clearance: 'tax',
    sars_pin: 'tax',
    vat_certificate: 'tax',
    cipc_registration: 'registration',
    company_profile: 'registration',
    csd_supplier_summary: 'registration',
    director_ids: 'registration',
    shareholder_register: 'registration',
    bbbee_certificate: 'bbbee',
    bbbee_affidavit: 'bbbee',
    cidb_certificate: 'certification',
    nhbrc_certificate: 'certification',
    letter_good_standing: 'certification',
    coida_certificate: 'certification',
    public_liability_insurance: 'legal',
    professional_indemnity: 'legal',
    financial_statements: 'financial',
    bank_statement: 'financial',
    bank_confirmation: 'financial',
    municipal_account: 'legal',
    proof_of_address: 'registration',
    lease_agreement: 'legal',
    health_safety_plan: 'policy',
    quality_management_policy: 'policy',
    environmental_policy: 'policy',
    iso_certificate: 'certification',
    poa_authority: 'legal',
    joint_venture_agreement: 'legal',
    other_compliance: 'certification',
    tax: 'tax',
    legal: 'legal',
    financial: 'financial',
    certification: 'certification',
    bbbee: 'bbbee',
    registration: 'registration',
    policy: 'policy',
};
export type ScoreBand = 'tender-ready' | 'partially-ready' | 'high-risk';
export type RenewalBucket = 'due-90' | 'due-60' | 'due-30' | 'due-7' | 'expired';

// ─── Auth ─────────────────────────────────────

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    verificationStatus?: 'pending' | 'approved' | 'rejected';
    onboardingCompleted?: boolean;
    avatar?: string;
}

export interface LoginResponse {
    token: string;
    user: AuthUser;
}

// ─── Company ──────────────────────────────────

export interface Company {
    id: string;
    name: string;
    registrationNumber: string;
    vatNumber: string;
    status: 'verified' | 'pending' | 'rejected';
    address: string;
    phone: string;
    email: string;
    website: string;
    industry: string;
    incorporatedDate: string;
    // SA-specific compliance fields
    csdNumber?: string | null;
    bbbeeLevel?: string | null;
    cidbGrade?: string | null;
    province?: string | null;
    tenderCategories?: string[];
}

// ─── Vault / Documents ────────────────────────

export interface VaultDocument {
    id: string;
    name: string;
    category: DocumentCategory;
    status: DocumentStatus;
    expiryDate: string | null;
    lastUpdated: string;
    uploadedBy: string;
    fileSize: string;
    fileType: string;
    issuingAuthority?: string;
}

export interface DocumentTimelineEvent {
    id: string;
    action: string;
    actor: string;
    timestamp: string;
    note?: string;
}

export interface VaultDocumentDetail extends VaultDocument {
    timeline: DocumentTimelineEvent[];
    metadata: Record<string, string>;
    extractionStatus?: 'ok' | 'failed' | 'skipped';
    extractionError?: string | null;
    pageCount?: number;
    extractedText?: string;
    aiSummary?: string;
    aiSummaryModel?: string;
    aiSummaryUpdatedAt?: string;
    documentAnalysis?: {
        wordCount: number;
        hasSignature: boolean;
        hasDate: boolean;
        hasCompanyName: boolean;
        hasRegistrationNumber: boolean;
        hasVatNumber: boolean;
        hasBBBEELevel: boolean;
        detectedDates: string[];
        detectedAmounts: string[];
        documentType: string | null;
        confidence: number;
        keywords: string[];
    };
}

export interface NotificationItem {
    id: string;
    alertType: string;
    title: string;
    message: string;
    isRead: boolean;
    triggerDate: string;
    createdAt: string | null;
}

// ─── Score ────────────────────────────────────

export interface ComplianceScore {
    score: number;
    band: ScoreBand;
    completedDocuments: number;
    totalDocuments: number;
    missingDocuments: string[];
    expiringDocuments: string[];
    lastCalculated: string;
    scoreBreakdown?: TenderReadinessScoreBreakdown;
}

export interface ScoreHistoryPoint {
    date: string;
    score: number;
    deterministicScore?: number;
    llmDeltaApplied?: number;
    confidenceScore?: number;
    tenderId?: string;
    tenderTitle?: string;
    trigger?: string;
    reasonCodes?: string[];
    source?: 'hybrid' | 'deterministic';
    model?: string;
    recommendation?: string;
}

// ─── Tenders ──────────────────────────────────

export interface TenderMatch {
    id: string;
    title: string;
    organization: string;
    deadline: string;
    value: string;
    matchScore: number;
    gaps: string[];
    category: string;
    location: string;
    description?: string;
    advertised?: string;
    closingTime?: string;
    requiredAt?: string;
    sourceUrl?: string;
    sourceSite?: string;
    tenderNumber?: string;
    tenderType?: string;
    province?: string;
    specialConditions?: string;
    briefing?: {
        hasBriefingSession: boolean;
        isCompulsory: boolean;
        date: string;
        venue: string;
    };
    contact?: {
        contactPerson: string;
        email: string;
        telephone: string;
        fax: string;
    };
    isScraped?: boolean;
    recommendationReason?: string;
    requirements?: string[];
    eligibilityCriteria?: string[];
    recommendedDocuments?: string[];
    required_categories?: string[];
    rejectionReason?: string;
    createdBy?: string;
    status?: 'draft' | 'pending' | 'published' | 'rejected';
    createdAt?: string;
    // B-3 Tender Match Intelligence fields
    readinessScore?: number;
    scoreBreakdown?: TenderReadinessScoreBreakdown;
    isBidReady?: boolean;
}

export interface TenderDetail extends TenderMatch {
    description: string;
    requirements: string[];
    recommendedDocuments: string[];
    eligibilityCriteria: string[];
}

export interface TenderReadinessScoreBreakdown {
    documentCompleteness: number;      // Max 30pts
    verificationCoverage: number;      // Max 25pts
    csdProfileCompleteness: number;    // Max 20pts
    complianceConsistency: number;     // Max 15pts
    tenderFitBonus: number;            // Max 10pts
}

export interface TenderReadiness {
    tenderId: string;
    readyToSubmit: boolean;
    readinessScore: number;
    scoreBreakdown?: TenderReadinessScoreBreakdown;
    isBidReady?: boolean;
    blockers: string[];
    missingCategories: string[];
    gaps: string[];
    recommendedDocuments: string[];
    checklist: Array<{ item: string; status: 'passed' | 'failed' | 'missing' }>;
}

export interface TenderCalendarItem {
    id: string;
    title: string;
    date: string;
    type: 'deadline';
    organization: string;
    matchScore: number;
    priority: 'high' | 'medium' | 'low';
    gapsCount: number;
}

// ─── Audit ────────────────────────────────────

export interface AuditEntry {
    id: string;
    actor: string;
    action: string;
    entity: string;
    entityId: string;
    timestamp: string;
    metadata: Record<string, unknown>;
}

// ─── Admin ────────────────────────────────────

export interface AdminStats {
    totalCompanies: number;
    tenderReady: number;
    partiallyReady: number;
    highRisk: number;
    totalDocuments: number;
    pendingVerification: number;
}

export interface RenewalItem {
    id: string;
    companyName: string;
    companyId: string;
    documentName: string;
    daysUntilExpiry: number;
    expiryDate: string;
    bucket: RenewalBucket;
}

// ─── Verify ───────────────────────────────────

export interface CompanySearchResult {
    id: string;
    name: string;
    registrationNumber: string;
    csdNumber?: string | null;
    industry?: string | null;
    province?: string | null;
    score: number;
    band: ScoreBand;
    lastUpdated: string;
}

export interface CompanyComplianceReport {
    company: Company;
    score: ComplianceScore;
    documentsByCategory: Partial<Record<DocumentCategory, VaultDocument[]>>;
    auditLog: AuditEntry[];
    bundleUrl: string;
    verification: {
        isVerified: boolean;
        lastVerifiedAt: string | null;
        generatedAt: string;
    };
}
