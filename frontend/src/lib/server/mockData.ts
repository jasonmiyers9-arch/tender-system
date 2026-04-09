import type { Company, TenderDetail, TenderMatch } from '@/lib/api/types';

export interface InternalUser {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: 'user' | 'evaluator' | 'admin';
  verificationStatus: 'approved' | 'pending' | 'rejected';
  activeCompanyId: string | null;
  companyId: string | null;
  companyName?: string;
  registrationNumber?: string;
  phone?: string;
  createdAt: string;
}

export interface InternalCompany extends Company {
  memberIds: string[];
}

export interface InternalTender extends TenderDetail {
  status: NonNullable<TenderMatch['status']>;
  isSystem: boolean;
  createdBy?: string;
  companyId?: string;
}

export interface InternalApplication {
  id: string;
  tenderId: string;
  companyId: string;
  userId: string;
  status: 'draft' | 'submitted' | 'under-review' | 'approved' | 'rejected';
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  documents: string[];
  createdAt: string;
}

export interface InternalDocument {
  id: string;
  companyId: string;
  name: string;
  category: 'tax' | 'legal' | 'financial' | 'certification' | 'bbbee' | 'registration' | 'policy';
  status: 'uploaded' | 'verified' | 'rejected' | 'expired';
  fileUrl: string | null;
  storagePath?: string;  // Firebase Storage path for deletion
  expiryDate: string | null;
  verified?: boolean;
  uploadedAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  // Enhanced metadata for PDF processing
  fileSize?: number;
  mimeType?: string;
  pageCount?: number;
  extractedText?: string;
  extractionStatus?: 'ok' | 'failed' | 'skipped';
  extractionError?: string | null;
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

export const DEFAULT_USER: InternalUser = {
  id: 'demo-user',
  email: 'demo@tenderguard.local',
  password: 'password',
  fullName: 'Tender Demo User',
  role: 'user',
  verificationStatus: 'approved',
  activeCompanyId: 'demo-company',
  companyId: 'demo-company',
  companyName: 'Demo Compliance Holdings',
  registrationNumber: '2024/123456/07',
  phone: '+27 21 555 0123',
  createdAt: new Date().toISOString(),
};

export const DEFAULT_COMPANIES: InternalCompany[] = [
  {
    id: 'demo-company',
    name: 'Demo Compliance Holdings',
    registrationNumber: '2024/123456/07',
    vatNumber: '1234567890',
    status: 'verified',
    address: '1 Demo Street, Cape Town, ZA',
    phone: '+27 21 555 0123',
    email: 'info@democompliance.co.za',
    website: 'https://democompliance.example',
    industry: 'Consulting',
    incorporatedDate: '2024-01-01',
    memberIds: ['demo-user'],
  },
];

export const DEFAULT_TENDERS: InternalTender[] = [
  {
    id: 'tender-1',
    title: 'Municipal IT Support Services (12 Months)',
    organization: 'City Infrastructure Dept',
    deadline: '2026-03-28',
    value: 'R 1.8M',
    category: 'IT Services',
    description: 'Provision of managed IT support, helpdesk, and endpoint maintenance for municipal offices.',
    requirements: [
      'Valid tax clearance certificate',
      'CIPC company registration',
      'B-BBEE certificate',
      'Audited/financial compliance documents',
    ],
    recommendedDocuments: [],
    eligibilityCriteria: [
      'Registered South African company',
      'At least 3 years relevant experience',
      'Good standing for tax and statutory filings',
    ],
    location: 'South Africa',
    matchScore: 82,
    gaps: ['Missing tax document', 'Missing financial document'],
    status: 'published',
    isSystem: true,
  },
  {
    id: 'tender-2',
    title: 'Provincial Facilities Maintenance Tender',
    organization: 'Provincial Public Works',
    deadline: '2026-04-05',
    value: 'R 3.2M',
    category: 'Facilities',
    description: 'General building maintenance, emergency response, and compliance servicing across provincial offices.',
    requirements: [
      'Tax compliance proof',
      'CIDB/technical certification',
      'Company registration documentation',
      'Insurance/financial backing',
    ],
    recommendedDocuments: [],
    eligibilityCriteria: [
      'Compliance with labour and safety laws',
      'Demonstrated service capacity',
      'Valid statutory documents',
    ],
    location: 'South Africa',
    matchScore: 56,
    gaps: ['Missing certification document', 'Missing financial document'],
    status: 'published',
    isSystem: true,
  },
  {
    id: 'tender-3',
    title: 'Digital Transformation Advisory Panel',
    organization: 'National Innovation Agency',
    deadline: '2026-04-18',
    value: 'R 950K',
    category: 'Consulting',
    description: 'Advisory support for digitization strategy, implementation planning, and governance alignment.',
    requirements: ['Company registration', 'Tax clearance', 'Professional/legal compliance docs'],
    recommendedDocuments: [],
    eligibilityCriteria: [
      'Relevant consulting track record',
      'Professional indemnity (where applicable)',
      'Regulatory compliance',
    ],
    location: 'South Africa',
    matchScore: 69,
    gaps: ['Missing registration document'],
    status: 'published',
    isSystem: true,
  },
];

export const DEFAULT_APPLICATIONS: InternalApplication[] = [
  {
    id: 'app-1',
    tenderId: 'tender-1',
    companyId: 'demo-company',
    userId: 'demo-user',
    status: 'submitted',
    submittedAt: '2026-03-15T10:30:00Z',
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    documents: ['doc-1', 'doc-2'],
    createdAt: '2026-03-10T09:00:00Z',
  },
];

export const DEFAULT_DOCUMENTS: InternalDocument[] = [
  {
    id: 'doc-1',
    companyId: 'demo-company',
    name: 'Tax Clearance Certificate 2025',
    category: 'tax',
    status: 'verified',
    fileUrl: '/uploads/company_1/tax-cert-2025.pdf',
    expiryDate: '2027-03-31',
    uploadedAt: '2026-03-10T09:00:00Z',
    verifiedAt: '2026-03-11T14:22:00Z',
    verifiedBy: 'admin-user',
  },
  {
    id: 'doc-2',
    companyId: 'demo-company',
    name: 'CIPC Registration',
    category: 'registration',
    status: 'verified',
    fileUrl: '/uploads/company_1/cipc-reg.pdf',
    expiryDate: null,
    uploadedAt: '2026-03-10T09:15:00Z',
    verifiedAt: '2026-03-11T14:25:00Z',
    verifiedBy: 'admin-user',
  },
];
