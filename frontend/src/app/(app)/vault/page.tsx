'use client';

import { useState, useRef } from 'react';
import { useVaultDocuments, useUploadDocument } from '@/lib/hooks/useVault';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/badges/Badges';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableRowSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate, docCategoryLabel } from '@/lib/utils/formatters';
import type { DocumentStatus, DocumentCategory, VaultDocument } from '@/lib/api/types';
import {
    Upload, MoreHorizontal, Plus, FolderLock, AlertTriangle,
    CheckCircle2, Clock, XCircle, FileText, Landmark, BadgeCheck,
    Scale, BarChart3, Award, ChevronRight, CloudUpload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Category metadata ────────────────────────────────────────────────────────

const CATEGORY_META: Record<DocumentCategory, {
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

const CATEGORY_COLORS: Record<DocumentCategory, { bg: string; text: string; border: string }> = {
    tax:           { bg: '#4F46E515', text: '#4F46E5', border: '#4F46E530' },
    registration:  { bg: '#0EA5E915', text: '#0EA5E9', border: '#0EA5E930' },
    bbbee:         { bg: '#10B98115', text: '#10B981', border: '#10B98130' },
    legal:         { bg: '#F59E0B15', text: '#F59E0B', border: '#F59E0B30' },
    financial:     { bg: '#EC489915', text: '#EC4899', border: '#EC489930' },
    certification: { bg: '#8B5CF615', text: '#8B5CF6', border: '#8B5CF630' },
    policy:        { bg: '#64748B15', text: '#64748B', border: '#64748B30' },
};

const ALL_CATEGORIES: DocumentCategory[] = ['tax', 'registration', 'bbbee', 'financial', 'legal', 'certification', 'policy'];

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
    category: DocumentCategory;
    docs: VaultDocument[];
    onUpload: (cat: DocumentCategory) => void;
    onRowClick: (doc: VaultDocument) => void;
}) {
    const meta = CATEGORY_META[category];
    const color = CATEGORY_COLORS[category];
    const isEmpty = docs.length === 0;
    const hasExpired = docs.some((d) => d.status === 'expired');
    const hasExpiringSoon = docs.some((d) => {
        if (!d.expiryDate || d.status === 'expired') return false;
        const diff = (new Date(d.expiryDate).getTime() - Date.now()) / 86400000;
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
    initialCategory: DocumentCategory | null;
    onUpload: (data: { name: string; category: DocumentCategory; file: File }) => void;
    isLoading: boolean;
}) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState<DocumentCategory>(initialCategory ?? 'tax');
    const [file, setFile] = useState<File | null>(null);
    const [issueDate, setIssueDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    // Sync category when modal opens with a pre-selected category
    const prevOpen = useRef(false);
    if (open && !prevOpen.current) {
        if (initialCategory) setCategory(initialCategory);
        setName('');
        setFile(null);
        setIssueDate('');
        setExpiryDate('');
    }
    prevOpen.current = open;

    const meta = CATEGORY_META[category];
    const color = CATEGORY_COLORS[category];

    const handleSubmit = () => {
        if (!file) return;
        onUpload({ name: name || file.name, category, file });
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
                        disabled={!file}
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
                        onChange={(e) => setCategory(e.target.value as DocumentCategory)}
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
                                {(file.size / 1024).toFixed(0)} KB · Click to change
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-medium text-[--color-text-primary]">Click to select a file</p>
                            <p className="text-xs text-[--color-text-muted]">PDF, DOC, JPG, PNG up to 10MB</p>
                        </>
                    )}
                    <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.txt"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                </label>
            </div>
        </Modal>
    );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function VaultPage() {
    const [statusFilter, setStatusFilter] = useState<DocumentStatus | ''>('');
    const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | ''>('');
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadCategory, setUploadCategory] = useState<DocumentCategory | null>(null);

    const router = useRouter();

    const allDocsQuery = useVaultDocuments();
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

    const openUpload = (cat: DocumentCategory | null = null) => {
        setUploadCategory(cat);
        setUploadOpen(true);
    };

    const handleUpload = async (data: { name: string; category: DocumentCategory; file: File }) => {
        await uploadMutation.mutateAsync(data);
        setUploadOpen(false);
    };

    const docsByCategory = (cat: DocumentCategory) =>
        allDocs.filter((d) => d.category === cat);

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
                subtitle="Manage all compliance documents for your entity"
                icon={<FolderLock size={22} />}
                actions={
                    <Button leftIcon={<Plus size={16} />} onClick={() => openUpload(null)}>
                        Upload Document
                    </Button>
                }
            />

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
                        {ALL_CATEGORIES.map((c) => (
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ALL_CATEGORIES.map((cat) => (
                            <CategoryCard
                                key={cat}
                                category={cat}
                                docs={docsByCategory(cat)}
                                onUpload={openUpload}
                                onRowClick={(doc) => router.push(`/vault/${doc.id}`)}
                            />
                        ))}
                    </div>
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

            <UploadModal
                open={uploadOpen}
                onClose={() => setUploadOpen(false)}
                initialCategory={uploadCategory}
                onUpload={handleUpload}
                isLoading={uploadMutation.isPending}
            />
        </div>
    );
}


