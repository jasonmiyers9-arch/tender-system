'use client';

import { usePendingAdminDocuments, useAdminDownloadDocument, useRejectDocument, useVerifyDocument } from '@/lib/hooks/useAdmin';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DownloadButton } from '@/components/ui/DownloadButton';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/badges/Badges';
import { formatDate, docCategoryLabel } from '@/lib/utils/formatters';
import type { DocumentCategory, DocumentStatus } from '@/lib/api/types';
import { CheckCircle, FileText, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';

export default function AdminDocumentsPage() {
    const pendingQuery = usePendingAdminDocuments();
    const verifyDoc = useVerifyDocument();
    const rejectDoc = useRejectDocument();
    const downloadDoc = useAdminDownloadDocument();

    if (pendingQuery.isLoading) return <CardSkeleton />;
    if (pendingQuery.isError) return <ErrorState onRetry={() => pendingQuery.refetch()} />;

    const docs = pendingQuery.data?.items ?? [];

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <PageHeader
                title="Pending Document Review"
                subtitle="Review newly uploaded compliance documents across all companies."
                icon={<FileText size={22} />}
                iconColor="#F59E0B"
                actions={
                    <Link href="/admin/companies">
                        <Button variant="ghost">View Companies</Button>
                    </Link>
                }
            />

            <Card>
                {docs.length === 0 ? (
                    <p className="text-sm text-[--color-text-muted] text-center py-10">No uploaded documents waiting for review.</p>
                ) : (
                    <div className="space-y-4">
                        {docs.map((doc) => (
                            <div key={doc.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-[--color-border] bg-[--color-bg] p-4">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-[--color-text-primary] flex items-center gap-2">
                                        <FileText size={15} className="text-[--color-primary] opacity-70" /> {doc.name}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[--color-text-muted]">
                                        <span>{doc.companyName}</span>
                                        <span>•</span>
                                        <span>{docCategoryLabel(doc.category as DocumentCategory)}</span>
                                        <span>•</span>
                                        <span>Uploaded {formatDate(doc.lastUpdated)}</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                    <StatusBadge status={doc.status as DocumentStatus} />
                                    <Link href={`/admin/companies/${doc.companyId}`}>
                                        <Button variant="ghost" size="sm">Open Company</Button>
                                    </Link>
                                    <DownloadButton
                                        size="sm"
                                        iconSize={14}
                                        onClick={() => downloadDoc.mutate({ docId: doc.id, filename: doc.name })}
                                    >
                                        Download
                                    </DownloadButton>
                                    <Button
                                        variant="success"
                                        size="sm"
                                        leftIcon={<CheckCircle size={14} />}
                                        onClick={() => verifyDoc.mutate(doc.id, { onSuccess: () => pendingQuery.refetch() })}
                                    >
                                        Verify
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        leftIcon={<XCircle size={14} />}
                                        onClick={() => rejectDoc.mutate({ docId: doc.id, reason: 'Rejected by admin' }, { onSuccess: () => pendingQuery.refetch() })}
                                    >
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
