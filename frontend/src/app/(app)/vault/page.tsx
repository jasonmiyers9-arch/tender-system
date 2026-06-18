'use client';

import { useMemo, useState, useRef } from 'react';
import { useVaultDocuments, useUploadDocument } from '@/lib/hooks/useVault';
import { useScore } from '@/lib/hooks/useScore';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/badges/Badges';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableRowSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate, docCategoryLabel } from '@/lib/utils/formatters';
import { DOCUMENT_CATEGORY_GROUPS, DOCUMENT_UPLOAD_CATEGORIES } from '@/lib/api/types';
import type { DocumentStatus, DocumentCategory, DocumentUploadCategory, VaultDocument } from '@/lib/api/types';
import {
    Upload, MoreHorizontal, Plus, FolderLock, AlertTriangle,
    CheckCircle2, Clock, XCircle, FileText, Landmark, BadgeCheck,
    Scale, BarChart3, Award, ChevronRight, CloudUpload,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

// ─── Category metadata ────────────────────────────────────────────────────────

const BASE_META: Record<string, {
    label: string;
    description: string;
    icon: React.ReactNode;
    required: boolean;
    examples: string;
}> = {
    tax: {
        label: 'Tax Clearance',
        description: 'SARS Tax Clearance or Tax Compliance Certificate',
        icon: <Landmark size={20} />,
        required: true,
        examples: 'Tax Clearance Certificate, SARS PIN',
    },
    registration: {
        label: 'Company Registration',
        description: 'Official incorporation or business registration proof',
        icon: <FileText size={20} />,
        required: true,
        examples: 'CIPC Certificate, CK Document',
    },
    bbbee: {
        label: 'B-BBEE Certificate',
        description: 'Broad-Based Black Economic Empowerment certificate',
        icon: <BadgeCheck size={20} />,
        required: true,
        examples: 'B-BBEE Level 1–8 Certificate, Sworn Affidavit',
    },
    legal: {
        label: 'Legal Documents',
        description: 'Shareholder agreements, MOA, powers of attorney',
        icon: <Scale size={20} />,
        required: false,
        examples: 'MOA, Shareholders Agreement, Legal Opinion',
    },
    financial: {
        label: 'Financial Statements',
        description: 'Audited financials, bank statements, annual reports',
        icon: <BarChart3 size={20} />,
        required: true,
        examples: 'Audited AFS, 3-Month Bank Statement',
    },
    certification: {
        label: 'Certifications',
        description: 'ISO, CIDB, quality management, or accreditation certificates',
        icon: <Award size={20} />,
        required: false,
        examples: 'ISO 9001, CIDB Grade Certificate',
    },
    policy: {
        label: 'Policies',
        description: 'Internal policies, procedures, and governance documents',
        icon: <FileText size={20} />,
        required: false,
        examples: 'HR Policy, Health & Safety Policy',
    },
};

const UPLOAD_CATEGORY_DETAILS: Record<DocumentUploadCategory, { description: string; required: boolean; examples: string }> = {
    tax_clearance: { description: 'SARS tax clearance certificate or equivalent proof', required: true, examples: 'Tax Clearance Certificate' },
    sars_pin: { description: 'SARS Tax Compliance Status PIN document', required: true, examples: 'SARS TCS PIN letter' },
    vat_certificate: { description: 'VAT registration or vendor certificate', required: false, examples: 'VAT103 Certificate' },
    cipc_registration: { description: 'Company registration issued by CIPC', required: true, examples: 'COR14.3, CK document' },
    company_profile: { description: 'Current supplier or company profile', required: false, examples: 'Company Profile PDF' },
    csd_supplier_summary: { description: 'Central Supplier Database supplier summary', required: true, examples: 'CSD Supplier Summary Report' },
    director_ids: { description: 'Identity documents for directors or members', required: false, examples: 'Certified Director IDs' },
    shareholder_register: { description: 'Ownership or shareholder register', required: false, examples: 'Share Register' },
    bbbee_certificate: { description: 'Valid B-BBEE certificate from accredited agency', required: true, examples: 'B-BBEE Level Certificate' },
    bbbee_affidavit: { description: 'B-BBEE sworn affidavit where applicable', required: true, examples: 'EME/QSE Affidavit' },
    cidb_certificate: { description: 'CIDB grading certificate for construction work', required: false, examples: 'CIDB Grade Certificate' },
    nhbrc_certificate: { description: 'NHBRC registration certificate', required: false, examples: 'NHBRC Certificate' },
    letter_good_standing: { description: 'Letter of good standing from Compensation Fund', required: false, examples: 'Letter of Good Standing' },
    coida_certificate: { description: 'COIDA registration or confirmation', required: false, examples: 'COIDA Certificate' },
    public_liability_insurance: { description: 'Public liability insurance schedule', required: false, examples: 'Public Liability Cover' },
    professional_indemnity: { description: 'Professional indemnity insurance where required', required: false, examples: 'PI Insurance Schedule' },
    financial_statements: { description: 'Annual financial statements or audited accounts', required: true, examples: 'AFS, Management Accounts' },
    bank_statement: { description: 'Recent bank statements', required: false, examples: '3-Month Bank Statement' },
    bank_confirmation: { description: 'Bank confirmation or account verification letter', required: false, examples: 'Bank Confirmation Letter' },
    municipal_account: { description: 'Municipal account or rates clearance document', required: false, examples: 'Municipal Account' },
    proof_of_address: { description: 'Proof of physical trading address', required: false, examples: 'Utility Bill, Lease Proof' },
    lease_agreement: { description: 'Lease agreement for business premises', required: false, examples: 'Signed Lease Agreement' },
    health_safety_plan: { description: 'Health and safety plan or file', required: false, examples: 'SHE Plan' },
    quality_management_policy: { description: 'Quality management policy or procedure', required: false, examples: 'QMS Policy' },
    environmental_policy: { description: 'Environmental management policy', required: false, examples: 'Environmental Policy' },
    iso_certificate: { description: 'ISO or standards accreditation certificate', required: false, examples: 'ISO 9001 Certificate' },
    poa_authority: { description: 'Power of attorney or signatory authority', required: false, examples: 'Authority Resolution' },
    joint_venture_agreement: { description: 'Joint venture or consortium agreement', required: false, examples: 'JV Agreement' },
    other_compliance: { description: 'Other tender-specific compliance evidence', required: false, examples: 'Special Permit, Licence' },
};

const CATEGORY_META: Record<DocumentUploadCategory, {
    label: string;
    description: string;
    icon: React.ReactNode;
    required: boolean;
    examples: string;
}> = Object.fromEntries(
    DOCUMENT_UPLOAD_CATEGORIES.map((category) => {
        const group = DOCUMENT_CATEGORY_GROUPS[category];
        const base = BASE_META[group];
        const detail = UPLOAD_CATEGORY_DETAILS[category];
        return [category, {
            label: docCategoryLabel(category),
            description: detail.description,
            icon: base.icon,
            required: detail.required,
            examples: detail.examples,
        }];
    })
) as Record<DocumentUploadCategory, {
    label: string;
    description: string;
    icon: React.ReactNode;
    required: boolean;
    examples: string;
}>;

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    tax:           { bg: '#4F46E515', text: '#4F46E5', border: '#4F46E530' },
    registration:  { bg: '#0EA5E915', text: '#0EA5E9', border: '#0EA5E930' },
    bbbee:         { bg: '#10B98115', text: '#10B981', border: '#10B98130' },
    legal:         { bg: '#F59E0B15', text: '#F59E0B', border: '#F59E0B30' },
    financial:     { bg: '#EC489915', text: '#EC4899', border: '#EC489930' },
    certification: { bg: '#8B5CF615', text: '#8B5CF6', border: '#8B5CF630' },
    policy:        { bg: '#64748B15', text: '#64748B', border: '#64748B30' },
};

const ALL_CATEGORIES: DocumentUploadCategory[] = [...DOCUMENT_UPLOAD_CATEGORIES];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / 1024 / 1024;
const PRIORITY_ONBOARDING_CATEGORIES: DocumentUploadCategory[] = [
    'bbbee_certificate',
    'sars_pin',
    'cipc_registration',
];

type VaultFilterGroup = 'all' | 'company' | 'tax' | 'government' | 'industry' | 'labour' | 'compliance';

const FILTER_GROUPS: Array<{ value: VaultFilterGroup; label: string; categories: DocumentUploadCategory[] }> = [
    { value: 'all', label: 'All', categories: [...DOCUMENT_UPLOAD_CATEGORIES] },
    { value: 'company', label: 'Company', categories: ['cipc_registration', 'company_profile', 'shareholder_register', 'director_ids', 'proof_of_address', 'lease_agreement'] },
    { value: 'tax', label: 'Tax', categories: ['tax_clearance', 'sars_pin', 'vat_certificate'] },
    { value: 'government', label: 'Government', categories: ['csd_supplier_summary', 'municipal_account', 'letter_good_standing', 'coida_certificate', 'nhbrc_certificate'] },
    { value: 'industry', label: 'Industry', categories: ['financial_statements', 'bank_statement', 'bank_confirmation', 'iso_certificate'] },
    { value: 'labour', label: 'Labour', categories: ['health_safety_plan', 'quality_management_policy', 'environmental_policy', 'public_liability_insurance', 'professional_indemnity'] },
    { value: 'compliance', label: 'Compliance', categories: ['bbbee_certificate', 'bbbee_affidavit', 'cidb_certificate', 'poa_authority', 'joint_venture_agreement', 'other_compliance'] },
];

const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'verified', label: 'Verified' },
    { value: 'uploaded', label: 'Uploaded' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
];

const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...ALL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label })),
];

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({
    category,
    docs,
    onUpload,
    onRowClick,
}: {
    category: DocumentUploadCategory;
    docs: VaultDocument[];
    onUpload: (cat: DocumentUploadCategory) => void;
    onRowClick: (doc: VaultDocument) => void;
}) {
    const meta = CATEGORY_META[category];
    const color = CATEGORY_COLORS[DOCUMENT_CATEGORY_GROUPS[category]];
    const isEmpty = docs.length === 0;
    const hasExpired = docs.some((d) => d.status === 'expired');
    const [referenceNow] = useState(() => Date.now());
    const hasExpiringSoon = docs.some((d) => {
        if (!d.expiryDate || d.status === 'expired') return false;
        const diff = (new Date(d.expiryDate).getTime() - referenceNow) / 86400000;
        return diff >= 0 && diff <= 30;
    });

    return (
        <div
            className="rounded-2xl border transition-all"
            style={{
                borderColor: isEmpty ? 'var(--color-border)' : color.border,
                background: isEmpty ? 'var(--color-surface)' : `var(--color-surface)`,
            }}
        >
            {/* Card header */}
            <div className="flex items-center gap-3 p-4 pb-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: color.bg, color: color.text }}
                >
                    {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[--color-text-primary] truncate">{meta.label}</p>
                        {meta.required && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ background: color.bg, color: color.text }}>
                                Required
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[--color-text-muted] truncate">{meta.description}</p>
                </div>
                {(hasExpired || hasExpiringSoon) && (
                    <AlertTriangle size={15} className={hasExpired ? 'text-[--color-danger]' : 'text-[--color-warning]'} />
                )}
            </div>

            <div className="border-t border-[--color-border] mx-4" />

            {/* Body */}
            {isEmpty ? (
                <div className="p-4 pt-3">
                    <p className="text-[11px] text-[--color-text-muted] mb-3">
                        <span className="font-medium text-[--color-text-secondary]">Examples: </span>
                        {meta.examples}
                    </p>
                    <button
                        onClick={() => onUpload(category)}
                        className="w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-3 text-sm font-medium transition-all hover:opacity-80"
                        style={{ borderColor: color.border, color: color.text, background: color.bg }}
                    >
                        <CloudUpload size={16} />
                        Upload {meta.label}
                    </button>
                </div>
            ) : (
                <div className="divide-y divide-[--color-border]">
                    {docs.map((doc) => (
                        <button
                            key={doc.id}
                            onClick={() => onRowClick(doc)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[--color-bg] transition-colors text-left"
                        >
                            <FileText size={14} className="text-[--color-text-muted] flex-shrink-0" />
                            <span className="flex-1 text-sm text-[--color-text-primary] truncate">{doc.name}</span>
                            <StatusBadge status={doc.status} />
                            <ChevronRight size={14} className="text-[--color-text-muted] flex-shrink-0" />
                        </button>
                    ))}
                    <div className="p-3">
                        <button
                            onClick={() => onUpload(category)}
                            className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-70"
                            style={{ color: color.text }}
                        >
                            <Plus size={13} /> Add another
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({
    open,
    onClose,
    initialCategory,
    onUpload,
    isLoading,
}: {
    open: boolean;
    onClose: () => void;
    initialCategory: DocumentUploadCategory | null;
    onUpload: (data: { name: string; category: DocumentUploadCategory; file: File }) => Promise<void> | void;
    isLoading: boolean;
}) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState<DocumentUploadCategory>(initialCategory ?? 'tax_clearance');
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [issueDate, setIssueDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const meta = CATEGORY_META[category];
    const color = CATEGORY_COLORS[DOCUMENT_CATEGORY_GROUPS[category]];

    const handleSubmit = async () => {
        if (!file) return;
        setUploadError(null);
        if (file.size > MAX_UPLOAD_BYTES) {
            setFileError(`File is too large. Maximum upload size is ${MAX_UPLOAD_MB} MB.`);
            return;
        }
        try {
            await onUpload({ name: name || file.name, category, file });
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.');
        }
    };

    const handleFileChange = (selected: File | null) => {
        setFile(selected);
        setUploadError(null);
        if (!selected) {
            setFileError(null);
            return;
        }
        if (selected.size > MAX_UPLOAD_BYTES) {
            setFileError(`File is too large. Maximum upload size is ${MAX_UPLOAD_MB} MB.`);
            return;
        }
        setFileError(null);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Upload Compliance Document"
            size="md"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        loading={isLoading}
                        disabled={!file || Boolean(fileError)}
                        leftIcon={<Upload size={15} />}
                    >
                        Upload
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                {/* Category selector — full grid if no locked category */}
                {initialCategory ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-[--color-border]"
                        style={{ background: color.bg }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: color.bg, color: color.text }}>
                            {meta.icon}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[--color-text-primary]">{meta.label}</p>
                            <p className="text-xs text-[--color-text-muted]">{meta.description}</p>
                        </div>
                    </div>
                ) : (
                    <Select
                        label="Category"
                        options={ALL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label }))}
                        value={category}
                        onChange={(e) => setCategory(e.target.value as DocumentUploadCategory)}
                    />
                )}

                <Input
                    label="Document Name"
                    placeholder={`e.g. ${meta.examples.split(',')[0]}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                    <Input
                        label="Issue Date (optional)"
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                    />
                    <Input
                        label="Expiry Date (optional)"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                    />
                </div>

                {/* File drop zone */}
                <label
                    className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:opacity-80"
                    style={{ borderColor: file ? color.border : 'var(--color-border)', background: file ? color.bg : 'transparent' }}
                >
                    <CloudUpload size={26} style={{ color: file ? color.text : 'var(--color-text-muted)' }} />
                    {file ? (
                        <>
                            <p className="text-sm font-semibold" style={{ color: color.text }}>{file.name}</p>
                            <p className="text-xs text-[--color-text-muted]">
                                {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-medium text-[--color-text-primary]">Click to select a file</p>
                            <p className="text-xs text-[--color-text-muted]">PDF, DOC, JPG, PNG up to {MAX_UPLOAD_MB}MB</p>
                        </>
                    )}
                    <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.txt"
                        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                </label>
                {fileError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[--color-danger]">
                        {fileError}
                    </div>
                )}
                {uploadError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[--color-danger]">
                        {uploadError}
                    </div>
                )}
            </div>
        </Modal>
    );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function VaultPage() {
    const searchParams = useSearchParams();
    const [statusFilter, setStatusFilter] = useState<DocumentStatus | ''>('');
    const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | ''>('');
    const [groupFilter, setGroupFilter] = useState<VaultFilterGroup>('all');
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadCategory, setUploadCategory] = useState<DocumentUploadCategory | null>(null);

    const router = useRouter();

    const allDocsQuery = useVaultDocuments();
    const scoreQuery = useScore();
    const allDocs = allDocsQuery.data ?? [];
    const today = new Date();

    const countVerified = allDocs.filter((d) => d.status === 'verified').length;
    const countExpired = allDocs.filter((d) => d.status === 'expired').length;
    const countExpiringSoon = allDocs.filter((d) => {
        if (!d.expiryDate || d.status === 'expired') return false;
        const diff = (new Date(d.expiryDate).getTime() - today.getTime()) / 86400000;
        return diff >= 0 && diff <= 30;
    }).length;

    const docsQuery = useVaultDocuments({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
    });
    const uploadMutation = useUploadDocument();
    const firstDocumentUploaded = allDocs.length === 1;
    const visibleCategories = useMemo(() => {
        const group = FILTER_GROUPS.find((item) => item.value === groupFilter) ?? FILTER_GROUPS[0];
        return group.categories;
    }, [groupFilter]);

    const openUpload = (cat: DocumentUploadCategory | null = null) => {
        setUploadCategory(cat);
        setUploadOpen(true);
    };

    const handleUpload = async (data: { name: string; category: DocumentUploadCategory; file: File }) => {
        await uploadMutation.mutateAsync(data);
        setUploadOpen(false);
    };

    const docsByCategory = (cat: DocumentUploadCategory) =>
        allDocs.filter((d) => d.category === cat);
    const onboardingMode = searchParams.get('onboarding') === '1';
    const priorityMissing = PRIORITY_ONBOARDING_CATEGORIES.filter((cat) => docsByCategory(cat).length === 0);

    const columns = [
        {
            key: 'name',
            header: 'Document Name',
            sortable: true,
            render: (doc: VaultDocument) => (
                <span className="font-medium text-[--color-text-primary]">{doc.name}</span>
            ),
        },
        {
            key: 'category',
            header: 'Category',
            render: (doc: VaultDocument) => (
                <span className="text-[--color-text-muted]">{docCategoryLabel(doc.category)}</span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (doc: VaultDocument) => <StatusBadge status={doc.status} />,
        },
        {
            key: 'expiryDate',
            header: 'Expiry Date',
            sortable: true,
            render: (doc: VaultDocument) => (
                <span className={doc.status === 'expired' ? 'text-[--color-danger] font-medium' : 'text-[--color-text-muted]'}>
                    {formatDate(doc.expiryDate)}
                </span>
            ),
        },
        {
            key: 'lastUpdated',
            header: 'Last Updated',
            render: (doc: VaultDocument) => (
                <span className="text-[--color-text-muted]">{formatDate(doc.lastUpdated)}</span>
            ),
        },
        {
            key: 'actions',
            header: '',
            width: '60px',
            render: () => (
                <button className="p-1 rounded hover:bg-[--color-bg] text-[--color-text-muted]">
                    <MoreHorizontal size={16} />
                </button>
            ),
        },
    ];

    const STAT_CARDS = [
        { label: 'Total Documents', value: allDocs.length, icon: <FolderLock size={18} />, color: '#4F46E5' },
        { label: 'Verified', value: countVerified, icon: <CheckCircle2 size={18} />, color: '#059669' },
        { label: 'Expiring Soon', value: countExpiringSoon, icon: <Clock size={18} />, color: '#D97706' },
        { label: 'Expired', value: countExpired, icon: <XCircle size={18} />, color: '#DC2626' },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="Compliance Vault"
                subtitle={`${countVerified} valid · ${countExpiringSoon} expiring · ${countExpired} expired`}
                icon={<FolderLock size={22} />}
                actions={
                    <Button leftIcon={<Plus size={16} />} onClick={() => openUpload(null)}>
                        Upload Document
                    </Button>
                }
            />

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {FILTER_GROUPS.map((group) => {
                    const active = groupFilter === group.value;
                    return (
                        <button
                            key={group.value}
                            type="button"
                            onClick={() => setGroupFilter(group.value)}
                            className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                                active
                                    ? 'border-teal-500 bg-teal-500/10 text-teal-700'
                                    : 'border-[--color-border] bg-[--color-surface] text-[--color-text-muted] hover:text-[--color-text-primary]'
                            }`}
                        >
                            {group.label}
                        </button>
                    );
                })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {allDocsQuery.isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} padding="sm">
                            <div className="flex items-center gap-3 py-1">
                                <Skeleton className="w-10 h-10 rounded-xl" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-6 w-10" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    STAT_CARDS.map((s) => (
                        <Card key={s.label} padding="sm">
                            <div className="flex items-center gap-3 py-1">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: `${s.color}15`, color: s.color }}
                                >
                                    {s.icon}
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-[--color-text-primary]">{s.value}</p>
                                    <p className="text-[10px] text-[--color-text-muted] leading-tight">{s.label}</p>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Expiry warning banner */}
            {(countExpiringSoon > 0 || countExpired > 0) && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <AlertTriangle size={17} className="text-[--color-warning] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-[--color-text-primary]">
                            {countExpired > 0
                                ? `${countExpired} document${countExpired > 1 ? 's' : ''} expired${countExpiringSoon > 0 ? ` · ${countExpiringSoon} expiring within 30 days` : ''}`
                                : `${countExpiringSoon} document${countExpiringSoon > 1 ? 's' : ''} expiring within 30 days`}
                        </p>
                        <p className="text-xs text-[--color-text-muted] mt-0.5">
                            Expired or near-expiry documents reduce your Tender Readiness Score. Renew them promptly.
                        </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setStatusFilter('expired')}>
                        Filter expired
                    </Button>
                </div>
            )}

            {onboardingMode && (
                <Card accent>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-[--color-text-primary]">Required before workspace access</p>
                            <p className="mt-1 text-xs text-[--color-text-muted]">
                                Upload these three priority documents: B-BBEE certificate, SARS TCS Pin, and CIPC registration certificate.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {PRIORITY_ONBOARDING_CATEGORIES.map((cat) => {
                                const uploaded = docsByCategory(cat).length > 0;
                                return (
                                    <Button
                                        key={cat}
                                        size="sm"
                                        variant={uploaded ? 'secondary' : 'primary'}
                                        leftIcon={uploaded ? <CheckCircle2 size={14} /> : <CloudUpload size={14} />}
                                        onClick={() => openUpload(cat)}
                                    >
                                        {CATEGORY_META[cat].label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                    {priorityMissing.length === 0 && (
                        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                            <p className="text-sm font-medium text-[--color-text-primary]">Priority documents are uploaded.</p>
                            <Button size="sm" rightIcon={<ChevronRight size={14} />} onClick={() => router.push('/onboarding')}>
                                Continue Setup
                            </Button>
                        </div>
                    )}
                </Card>
            )}

            {firstDocumentUploaded && scoreQuery.data && (
                <Card accent>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-[--color-text-primary]">Tender Readiness Score™ generated</p>
                            <p className="text-xs text-[--color-text-muted]">
                                Your first document has been saved. The system has now calculated an initial readiness score and highlighted what still needs attention.
                            </p>
                            <div className="flex items-center gap-3 pt-1">
                                <Badge variant={scoreQuery.data.band === 'tender-ready' ? 'success' : scoreQuery.data.band === 'partially-ready' ? 'warning' : 'danger'} size="md">
                                    {scoreQuery.data.score}/100
                                </Badge>
                                <span className="text-xs text-[--color-text-muted]">
                                    {scoreQuery.data.completedDocuments} of {scoreQuery.data.totalDocuments} required categories complete
                                </span>
                            </div>
                        </div>
                        <div className="grid gap-2 min-w-0 lg:max-w-xl">
                            {scoreQuery.data.missingDocuments.slice(0, 3).map((cat) => (
                                <div key={cat} className="rounded-xl border border-[--color-border] bg-[--color-surface-raised] px-3 py-2 text-xs text-[--color-text-primary]">
                                    Missing: {docCategoryLabel(cat)}
                                </div>
                            ))}
                            {scoreQuery.data.expiringDocuments.length > 0 && (
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-[--color-text-primary]">
                                    Near expiry: {scoreQuery.data.expiringDocuments.slice(0, 2).join(', ')}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            )}

            {/* Category grid */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-[--color-text-primary]">Document Categories</h2>
                    <span className="text-xs text-[--color-text-muted]">
                        {ALL_CATEGORIES.filter((c) => docsByCategory(c).length > 0).length} / {ALL_CATEGORIES.length} categories filled
                    </span>
                </div>
                {allDocsQuery.isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visibleCategories.map((c) => (
                            <div key={c} className="rounded-2xl border border-[--color-border] bg-[--color-surface] overflow-hidden">
                                <div className="flex items-center gap-3 p-4 pb-3">
                                    <Skeleton className="w-10 h-10 rounded-xl" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-4 w-28" />
                                        <Skeleton className="h-3 w-44" />
                                    </div>
                                </div>
                                <div className="border-t border-[--color-border] mx-4" />
                                <div className="p-4 pt-3 space-y-2.5">
                                    <Skeleton className="h-3 w-36" />
                                    <Skeleton className="h-10 w-full rounded-xl" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    visibleCategories.length === 0 ? (
                        <Card className="py-12 text-center">
                            <FileText size={28} className="mx-auto mb-3 text-[--color-text-muted]" />
                            <p className="text-sm font-semibold text-[--color-text-primary]">No documents in this category yet</p>
                            <p className="mt-1 text-xs text-[--color-text-muted]">Upload a document to populate this section.</p>
                            <Button className="mt-4" leftIcon={<CloudUpload size={14} />} onClick={() => openUpload(null)}>
                                Upload Document
                            </Button>
                        </Card>
                    ) : (
                        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                            {visibleCategories.map((cat) => (
                                <CategoryCard
                                    key={cat}
                                    category={cat}
                                    docs={docsByCategory(cat)}
                                    onUpload={openUpload}
                                    onRowClick={(doc) => router.push(`/vault/${doc.id}`)}
                                />
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* All Documents table */}
            {allDocs.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-[--color-text-primary]">All Documents</h2>
                        <div className="flex gap-2">
                            <div className="w-40">
                                <Select
                                    options={statusOptions}
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | '')}
                                    placeholder="All Statuses"
                                />
                            </div>
                            <div className="w-44">
                                <Select
                                    options={categoryOptions}
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value as DocumentCategory | '')}
                                    placeholder="All Categories"
                                />
                            </div>
                        </div>
                    </div>

                    {docsQuery.isLoading ? (
                        <Card padding="none">
                            <table className="w-full text-sm">
                                <tbody>
                                    {[1, 2, 3].map((i) => <TableRowSkeleton key={i} cols={6} />)}
                                </tbody>
                            </table>
                        </Card>
                    ) : docsQuery.isError ? (
                        <ErrorState onRetry={() => docsQuery.refetch()} />
                    ) : (
                        <Table
                            columns={columns}
                            data={docsQuery.data ?? []}
                            keyExtractor={(d) => d.id}
                            onRowClick={(doc) => router.push(`/vault/${doc.id}`)}
                        />
                    )}
                </div>
            )}

            {uploadOpen && (
                <UploadModal
                    key={uploadCategory ?? 'default'}
                    open={uploadOpen}
                    onClose={() => setUploadOpen(false)}
                    initialCategory={uploadCategory}
                    onUpload={handleUpload}
                    isLoading={uploadMutation.isPending}
                />
            )}
        </div>
    );
}


