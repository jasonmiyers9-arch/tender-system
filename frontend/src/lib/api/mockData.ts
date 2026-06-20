import type {
    AuthUser,
    Company,
    VaultDocument,
    VaultDocumentDetail,
    ComplianceScore,
    ScoreHistoryPoint,
    TenderMatch,
    TenderDetail,
    AuditEntry,
    AdminStats,
    RenewalItem,
    CompanySearchResult,
    CompanyComplianceReport,
} from './types';

// ─── Users ────────────────────────────────────

export const mockUsers: AuthUser[] = [
    {
        id: 'user-1',
        name: 'Vusu Admin',
        email: 'vusu@zenithcontractors.co.za',
        role: 'admin',
    },
    {
        id: 'user-2',
        name: 'Amahle Nkosi',
        email: 'amahle@evaluators.co.za',
        role: 'evaluator',
    },
    {
        id: 'user-3',
        name: 'Thabo Mokoena',
        email: 'thabo@apexinfra.co.za',
        role: 'user',
    },
];

// ─── Companies ────────────────────────────────

export const mockCompanies: Company[] = [
    {
        id: 'company-1',
        name: 'Zenith Contractors (Pty) Ltd',
        registrationNumber: '2018/345678/07',
        vatNumber: '4450123456',
        status: 'verified',
        address: '12 Commerce Drive, Sandton, Johannesburg, 2196',
        phone: '+27 11 234 5678',
        email: 'info@zenithcontractors.co.za',
        website: 'www.zenithcontractors.co.za',
        industry: 'Construction & Infrastructure',
        incorporatedDate: '2018-03-15',
    },
    {
        id: 'company-2',
        name: 'Apex Infrastructure Solutions',
        registrationNumber: '2020/112233/07',
        vatNumber: '4450789012',
        status: 'pending',
        address: '45 Industrial Park, Cape Town, 8001',
        phone: '+27 21 876 5432',
        email: 'info@apexinfra.co.za',
        website: 'www.apexinfra.co.za',
        industry: 'Engineering Services',
        incorporatedDate: '2020-07-01',
    },
    {
        id: 'company-3',
        name: 'BlueSky Tech (Pty) Ltd',
        registrationNumber: '2019/567890/07',
        vatNumber: '4450345678',
        status: 'verified',
        address: '30 Innovation Hub, Tshwane, 0001',
        phone: '+27 12 345 6789',
        email: 'hello@blueskytech.co.za',
        website: 'www.blueskytech.co.za',
        industry: 'Information Technology',
        incorporatedDate: '2019-11-20',
    },
];

// ─── Vault Documents ──────────────────────────

export const mockDocuments: VaultDocument[] = [
    {
        id: 'doc-1',
        name: 'Tax Clearance Certificate',
        category: 'tax',
        status: 'verified',
        expiryDate: '2026-12-31',
        lastUpdated: '2025-01-15',
        uploadedBy: 'Vusu Admin',
        fileSize: '1.2 MB',
        fileType: 'PDF',
    },
    {
        id: 'doc-2',
        name: 'CIPC Certificate of Incorporation',
        category: 'registration',
        status: 'verified',
        expiryDate: null,
        lastUpdated: '2024-06-01',
        uploadedBy: 'Vusu Admin',
        fileSize: '876 KB',
        fileType: 'PDF',
    },
    {
        id: 'doc-3',
        name: 'B-BBEE Certificate (Level 2)',
        category: 'bbbee',
        status: 'uploaded',
        expiryDate: '2025-09-30',
        lastUpdated: '2025-03-01',
        uploadedBy: 'Zanele Khumalo',
        fileSize: '2.1 MB',
        fileType: 'PDF',
    },
    {
        id: 'doc-4',
        name: 'Audited Financial Statements 2024',
        category: 'financial',
        status: 'verified',
        expiryDate: '2025-06-30',
        lastUpdated: '2024-08-20',
        uploadedBy: 'Vusu Admin',
        fileSize: '4.5 MB',
        fileType: 'PDF',
    },
    {
        id: 'doc-5',
        name: 'Professional Indemnity Insurance',
        category: 'legal',
        status: 'expired',
        expiryDate: '2025-01-31',
        lastUpdated: '2024-02-01',
        uploadedBy: 'Vusu Admin',
        fileSize: '980 KB',
        fileType: 'PDF',
    },
    {
        id: 'doc-6',
        name: 'ISO 9001:2015 Certification',
        category: 'certification',
        status: 'rejected',
        expiryDate: '2025-12-01',
        lastUpdated: '2025-02-10',
        uploadedBy: 'Zanele Khumalo',
        fileSize: '1.8 MB',
        fileType: 'PDF',
    },
    {
        id: 'doc-7',
        name: 'Company Registration Certificate (COR14.3)',
        category: 'registration',
        status: 'verified',
        expiryDate: null,
        lastUpdated: '2023-11-05',
        uploadedBy: 'Vusu Admin',
        fileSize: '640 KB',
        fileType: 'PDF',
    },
    {
        id: 'doc-8',
        name: 'VAT Registration Certificate',
        category: 'tax',
        status: 'verified',
        expiryDate: null,
        lastUpdated: '2023-05-12',
        uploadedBy: 'Vusu Admin',
        fileSize: '520 KB',
        fileType: 'PDF',
    },
];

export const mockDocumentDetail: VaultDocumentDetail = {
    ...mockDocuments[0],
    timeline: [
        {
            id: 'evt-1',
            action: 'Document uploaded',
            actor: 'Vusu Admin',
            timestamp: '2025-01-15T08:30:00Z',
        },
        {
            id: 'evt-2',
            action: 'Submitted for verification',
            actor: 'System',
            timestamp: '2025-01-15T08:31:00Z',
        },
        {
            id: 'evt-3',
            action: 'Verified',
            actor: 'Amahle Nkosi (Evaluator)',
            timestamp: '2025-01-17T14:22:00Z',
            note: 'Document verified against SARS records. Valid.',
        },
    ],
    metadata: {
        'Issuing Authority': 'South African Revenue Service (SARS)',
        'Reference Number': 'TCC-2025-0012345',
        'Valid From': '2025-01-01',
        'Valid To': '2026-12-31',
        'Document Format': 'PDF/A',
    },
};

// ─── Compliance Score ─────────────────────────

export const mockScore: ComplianceScore = {
    score: 78,
    band: 'partially-ready',
    completedDocuments: 6,
    totalDocuments: 9,
    missingDocuments: [
        'Public Liability Insurance',
        'NHBRC Enrolment Certificate',
        'CIDB Grading Certificate',
    ],
    expiringDocuments: [
        'B-BBEE Certificate (expires 30 Sep 2025)',
        'Audited Financial Statements (expires 30 Jun 2025)',
    ],
    lastCalculated: '2025-03-04T10:00:00Z',
};

export const mockScoreHistory: ScoreHistoryPoint[] = [
    { date: '2024-09-01', score: 55 },
    { date: '2024-10-01', score: 60 },
    { date: '2024-11-01', score: 65 },
    { date: '2024-12-01', score: 70 },
    { date: '2025-01-01', score: 72 },
    { date: '2025-02-01', score: 75 },
    { date: '2025-03-01', score: 78 },
];

// ─── Tenders ──────────────────────────────────

export const mockTenders: TenderMatch[] = [
    {
        id: 'tender-1',
        title: 'Construction of Community Health Centre — Phase 2',
        organization: 'Gauteng Department of Health',
        deadline: '2025-04-15',
        value: 'R 45,000,000',
        matchScore: 82,
        gaps: ['NHBRC Enrolment', 'CIDB Grade 6 CE'],
        category: 'Construction',
        location: 'Soweto, Gauteng',
    },
    {
        id: 'tender-2',
        title: 'ICT Infrastructure Upgrade — Municipal Council',
        organization: 'City of Tshwane Metropolitan Municipality',
        deadline: '2025-03-28',
        value: 'R 8,500,000',
        matchScore: 91,
        gaps: [],
        category: 'ICT',
        location: 'Tshwane, Gauteng',
    },
    {
        id: 'tender-3',
        title: 'Provision of Professional Engineering Services',
        organization: 'South African National Roads Agency (SANRAL)',
        deadline: '2025-05-01',
        value: 'R 12,000,000',
        matchScore: 68,
        gaps: ['Professional Indemnity Insurance (expired)', 'ISO 9001 Certification'],
        category: 'Engineering',
        location: 'National',
    },
    {
        id: 'tender-4',
        title: 'Supply and Installation of Solar Panels',
        organization: 'Eskom Holdings SOC Ltd',
        deadline: '2025-03-31',
        value: 'R 2,300,000',
        matchScore: 55,
        gaps: ['B-BBEE Level 1 Required', 'ISO 14001 Certification', 'NERSA Registration'],
        category: 'Energy',
        location: 'Cape Town, Western Cape',
    },
];

export const mockTenderDetail: TenderDetail = {
    ...mockTenders[0],
    description:
        'The Gauteng Department of Health invites bids from suitably qualified and experienced contractors for the construction of a community health centre in Soweto, Gauteng. The project includes erection of a 2,000m² primary healthcare facility, associated civil works, mechanical and electrical installations.',
    requirements: [
        'Valid Tax Clearance Certificate',
        'CIPC Registration',
        'B-BBEE Level 4 or better',
        'CIDB Grade 6 CE or higher',
        'NHBRC Enrolment',
        'Proof of similar projects (min. R20M)',
    ],
    recommendedDocuments: [
        'NHBRC Enrolment Certificate',
        'CIDB Grading Certificate',
        'Audited Financial Statements (latest)',
    ],
    eligibilityCriteria: [
        'South African registered entity',
        'Valid tax compliance status',
        'Minimum 5 years construction experience',
        'Joint venture allowed (lead partner ≥51% ownership)',
    ],
};

// ─── Audit Log ────────────────────────────────

export const mockAuditLog: AuditEntry[] = [
    {
        id: 'audit-1',
        actor: 'Vusu Admin',
        action: 'Document uploaded',
        entity: 'VaultDocument',
        entityId: 'doc-3',
        timestamp: '2025-03-01T09:15:00Z',
        metadata: { documentName: 'B-BBEE Certificate (Level 2)' },
    },
    {
        id: 'audit-2',
        actor: 'Amahle Nkosi',
        action: 'Document verified',
        entity: 'VaultDocument',
        entityId: 'doc-1',
        timestamp: '2025-01-17T14:22:00Z',
        metadata: { documentName: 'Tax Clearance Certificate', note: 'Verified against SARS records' },
    },
    {
        id: 'audit-3',
        actor: 'Amahle Nkosi',
        action: 'Document rejected',
        entity: 'VaultDocument',
        entityId: 'doc-6',
        timestamp: '2025-02-10T11:05:00Z',
        metadata: { documentName: 'ISO 9001:2015 Certification', reason: 'Certificate scope mismatch' },
    },
    {
        id: 'audit-4',
        actor: 'System',
        action: 'Score recalculated',
        entity: 'ComplianceScore',
        entityId: 'company-1',
        timestamp: '2025-03-04T10:00:00Z',
        metadata: { previousScore: 75, newScore: 78 },
    },
    {
        id: 'audit-5',
        actor: 'Vusu Admin',
        action: 'Company profile updated',
        entity: 'Company',
        entityId: 'company-1',
        timestamp: '2025-02-25T16:30:00Z',
        metadata: { fields: ['phone', 'website'] },
    },
];

// ─── Admin Stats ──────────────────────────────

export const mockAdminStats: AdminStats = {
    totalCompanies: 47,
    tenderReady: 18,
    partiallyReady: 21,
    highRisk: 8,
    totalDocuments: 312,
    pendingVerification: 14,
};

export const mockRenewalPipeline: RenewalItem[] = [
    {
        id: 'ren-1',
        companyName: 'Apex Infrastructure Solutions',
        companyId: 'company-2',
        documentName: 'Tax Clearance Certificate',
        daysUntilExpiry: 85,
        expiryDate: '2025-06-01',
        bucket: 'due-90',
    },
    {
        id: 'ren-2',
        companyName: 'Zenith Contractors (Pty) Ltd',
        companyId: 'company-1',
        documentName: 'B-BBEE Certificate',
        daysUntilExpiry: 58,
        expiryDate: '2025-05-01',
        bucket: 'due-60',
    },
    {
        id: 'ren-3',
        companyName: 'BlueSky Tech (Pty) Ltd',
        companyId: 'company-3',
        documentName: 'Professional Indemnity Insurance',
        daysUntilExpiry: 25,
        expiryDate: '2025-03-29',
        bucket: 'due-30',
    },
    {
        id: 'ren-4',
        companyName: 'Apex Infrastructure Solutions',
        companyId: 'company-2',
        documentName: 'ISO 9001 Certification',
        daysUntilExpiry: 5,
        expiryDate: '2025-03-09',
        bucket: 'due-7',
    },
    {
        id: 'ren-5',
        companyName: 'Zenith Contractors (Pty) Ltd',
        companyId: 'company-1',
        documentName: 'Professional Indemnity Insurance',
        daysUntilExpiry: -32,
        expiryDate: '2025-01-31',
        bucket: 'expired',
    },
];

// ─── Verify ───────────────────────────────────

export const mockSearchResults: CompanySearchResult[] = [
    {
        id: 'company-1',
        name: 'Zenith Contractors (Pty) Ltd',
        registrationNumber: '2018/345678/07',
        score: 78,
        band: 'partially-ready',
        lastUpdated: '2025-03-04',
    },
    {
        id: 'company-2',
        name: 'Apex Infrastructure Solutions',
        registrationNumber: '2020/112233/07',
        score: 52,
        band: 'high-risk',
        lastUpdated: '2025-02-28',
    },
    {
        id: 'company-3',
        name: 'BlueSky Tech (Pty) Ltd',
        registrationNumber: '2019/567890/07',
        score: 91,
        band: 'tender-ready',
        lastUpdated: '2025-03-01',
    },
];

export const mockComplianceReport: CompanyComplianceReport = {
    company: mockCompanies[0],
    score: mockScore,
    documentsByCategory: {
        tax: [mockDocuments[0], mockDocuments[7]],
        registration: [mockDocuments[1], mockDocuments[6]],
        bbbee: [mockDocuments[2]],
        financial: [mockDocuments[3]],
        legal: [mockDocuments[4]],
        certification: [mockDocuments[5]],
    },
    auditLog: mockAuditLog,
    bundleUrl: '/mock-compliance-bundle.pdf',
    verification: {
        isVerified: true,
        lastVerifiedAt: '2025-03-01T10:00:00.000Z',
        generatedAt: '2025-03-01T10:00:00.000Z',
    },
};
