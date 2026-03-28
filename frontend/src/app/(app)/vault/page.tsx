'use client';

import { useState } from 'react';
import { useVaultDocuments, useUploadDocument } from '@/lib/hooks/useVault';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/badges/Badges';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { formatDate, docCategoryLabel } from '@/lib/utils/formatters';
import type { DocumentStatus, DocumentCategory, VaultDocument } from '@/lib/api/types';
import { Upload, MoreHorizontal, Plus, FolderLock, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'verified', label: 'Verified' },
    { value: 'uploaded', label: 'Uploaded' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
];

const categoryOptions = [
    { value: '', label: 'All Categories' },
    { value: 'tax', label: 'Tax' },
    { value: 'legal', label: 'Legal' },
    { value: 'financial', label: 'Financial' },
    { value: 'bbbee', label: 'B-BBEE' },
    { value: 'certification', label: 'Certification' },
    { value: 'registration', label: 'Registration' },
];

export default function VaultPage() {
    const [statusFilter, setStatusFilter] = useState<DocumentStatus | ''>('');
    const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | ''>('');
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadName, setUploadName] = useState('');
    const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('tax');
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    const router = useRouter();

    // Derived counts from unfiltered docs (always fetch all for stats)
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

    const handleUpload = async () => {
        if (!uploadFile) return;
        await uploadMutation.mutateAsync({ name: uploadName || uploadFile.name, category: uploadCategory, file: uploadFile });
        setUploadOpen(false);
        setUploadName('');
        setUploadFile(null);
    };

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
                <span
                    className={
                        doc.status === 'expired' ? 'text-[--color-danger] font-medium' : 'text-[--color-text-muted]'
                    }
                >
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
            render: (_doc: VaultDocument) => (
                <button className="p-1 rounded hover:bg-[--color-bg] text-[--color-text-muted]">
                    <MoreHorizontal size={16} />
                </button>
            ),
        },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">Compliance Vault</h1>
                    <p className="text-sm text-[--color-text-muted] mt-0.5">
                        Manage all compliance documents for your entity
                    </p>
                </div>
                <Button leftIcon={<Plus size={16} />} onClick={() => setUploadOpen(true)}>
                    Upload Document
                </Button>
            </div>

            {/* Stats header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Documents', value: allDocs.length, icon: <FolderLock size={16} />, color: 'text-[--color-primary]' },
                    { label: 'Verified', value: countVerified, icon: <CheckCircle2 size={16} />, color: 'text-[--color-success]' },
                    { label: 'Expiring ≤ 30 days', value: countExpiringSoon, icon: <Clock size={16} />, color: 'text-[--color-warning]' },
                    { label: 'Expired', value: countExpired, icon: <XCircle size={16} />, color: 'text-[--color-danger]' },
                ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4 flex items-center gap-3">
                        <span className={s.color}>{s.icon}</span>
                        <div>
                            <p className="text-xl font-bold text-[--color-text-primary]">{s.value}</p>
                            <p className="text-[10px] text-[--color-text-muted] leading-tight">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Expiry warning banner */}
            {(countExpiringSoon > 0 || countExpired > 0) && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
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
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatusFilter('expired')}
                    >
                        Filter expired
                    </Button>
                </div>
            )}

            {/* Filters */}
            <Card padding="sm">
                <div className="flex flex-wrap gap-3">
                    <div className="w-48">
                        <Select
                            options={statusOptions}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | '')}
                            placeholder="All Statuses"
                        />
                    </div>
                    <div className="w-48">
                        <Select
                            options={categoryOptions}
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value as DocumentCategory | '')}
                            placeholder="All Categories"
                        />
                    </div>
                </div>
            </Card>

            {/* Table */}
            {docsQuery.isLoading ? (
                <div className="rounded-xl border border-[--color-border] overflow-hidden">
                    <table className="w-full text-sm">
                        <tbody>
                            {[1, 2, 3, 4, 5].map((i) => <TableRowSkeleton key={i} cols={6} />)}
                        </tbody>
                    </table>
                </div>
            ) : docsQuery.isError ? (
                <ErrorState onRetry={() => docsQuery.refetch()} />
            ) : !docsQuery.data?.length ? (
                <EmptyState
                    icon={<FolderLock size={28} />}
                    title="No documents found"
                    description="Upload your first compliance document to get started."
                    action={{ label: 'Upload Document', onClick: () => setUploadOpen(true) }}
                />
            ) : (
                <Table
                    columns={columns}
                    data={docsQuery.data}
                    keyExtractor={(d) => d.id}
                    onRowClick={(doc) => router.push(`/vault/${doc.id}`)}
                />
            )}

            {/* Upload Modal */}
            <Modal
                open={uploadOpen}
                onClose={() => setUploadOpen(false)}
                title="Upload Document"
                size="md"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setUploadOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpload}
                            loading={uploadMutation.isPending}
                            disabled={!uploadFile}
                            leftIcon={<Upload size={15} />}
                        >
                            Upload
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="Document Name"
                        placeholder="e.g. Tax Clearance Certificate 2025"
                        value={uploadName}
                        onChange={(e) => setUploadName(e.target.value)}
                    />
                    <Select
                        label="Category"
                        options={categoryOptions.filter((o) => o.value)}
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                    />
                    <label className="block border-2 border-dashed border-[--color-border] rounded-xl p-8 text-center hover:border-[--color-primary] transition-colors cursor-pointer">
                        <Upload size={24} className="mx-auto text-[--color-text-muted] mb-2" />
                        <p className="text-sm font-medium text-[--color-text-primary]">
                            Click to select a file
                        </p>
                        <p className="text-xs text-[--color-text-muted] mt-1">PDF, JPG, PNG up to 10MB</p>
                        <input
                            type="file"
                            className="hidden"
                            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                        />
                        {uploadFile && (
                            <p className="text-xs text-[--color-primary] mt-2">Selected: {uploadFile.name}</p>
                        )}
                    </label>
                </div>
            </Modal>
        </div>
    );
}
