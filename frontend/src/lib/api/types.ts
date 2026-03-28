// ─────────────────────────────────────────────
// TenderGuard Pro — Shared API Types
// ─────────────────────────────────────────────

export type UserRole = 'user' | 'evaluator' | 'admin';
export type DocumentStatus = 'uploaded' | 'verified' | 'rejected' | 'expired';
export type DocumentCategory =
    | 'tax'
    | 'legal'
    | 'financial'
    | 'certification'
    | 'bbbee'
    | 'registration';
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
}

export interface ScoreHistoryPoint {
    date: string;
    score: number;
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
}

export interface TenderDetail extends TenderMatch {
    description: string;
    requirements: string[];
    recommendedDocuments: string[];
    eligibilityCriteria: string[];
}

export interface TenderReadiness {
    tenderId: string;
    readyToSubmit: boolean;
    readinessScore: number;
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
}
