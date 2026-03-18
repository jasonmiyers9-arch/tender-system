'use client';

import type { ReactNode } from 'react';
import { useRequestVerification, useVaultDocument } from '@/lib/hooks/useVault';
import { vault } from '@/lib/api/vault';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/badges/Badges';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate, formatDateTime, docCategoryLabel } from '@/lib/utils/formatters';
import { Download, RefreshCw, CheckCircle, XCircle, Clock, Upload } from 'lucide-react';
import { useParams } from 'next/navigation';

const timelineIcons: Record<string, ReactNode> = {
    'Document uploaded': <Upload size={14} />,
    'Submitted for verification': <Clock size={14} />,
    'Verified': <CheckCircle size={14} />,
    'Rejected': <XCircle size={14} />,
};

export default function VaultDocumentPage() {
    const params = useParams<{ docId: string }>();
    const docId = params?.docId;
    const { data: doc, isLoading, isError, refetch } = useVaultDocument(docId ?? '');
    const requestVerification = useRequestVerification();

    if (isLoading) return <CardSkeleton />;
    if (isError || !doc) return <ErrorState onRetry={refetch} />;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">{doc.name}</h1>
                    <p className="text-sm text-[--color-text-muted] mt-0.5">
                        {docCategoryLabel(doc.category)} · Uploaded by {doc.uploadedBy}
                    </p>
                </div>
                <div className="flex gap-2">
                    <a href={vault.getDownloadUrl(doc.id)} target="_blank" rel="noreferrer">
                        <Button variant="ghost" leftIcon={<Download size={15} />} size="sm">
                            Download
                        </Button>
                    </a>
                    {(doc.status === 'expired' || doc.status === 'rejected') && (
                        <Button leftIcon={<RefreshCw size={15} />} size="sm">
                            Renew
                        </Button>
                    )}
                    {doc.status !== 'verified' && (
                        <Button
                            size="sm"
                            onClick={() => requestVerification.mutate(doc.id)}
                            loading={requestVerification.isPending}
                        >
                            Request Verification
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metadata */}
                <div className="md:col-span-2 space-y-4">
                    <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Document Details</h3>}>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                            {[
                                ['Status', <StatusBadge key="s" status={doc.status} />],
                                ['Expiry Date', formatDate(doc.expiryDate)],
                                ['Last Updated', formatDate(doc.lastUpdated)],
                                ['File Size', doc.fileSize],
                                ['File Type', doc.fileType],
                                ...Object.entries(doc.metadata).map(([k, v]) => [k, v]),
                            ].map(([label, value]) => (
                                <div key={String(label)}>
                                    <dt className="text-[--color-text-muted] mb-0.5">{label}</dt>
                                    <dd className="font-medium text-[--color-text-primary]">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </Card>

                    {/* Timeline */}
                    <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Status Timeline</h3>}>
                        <ol className="relative border-l border-[--color-border] ml-3 space-y-6">
                            {doc.timeline.map((evt) => (
                                <li key={evt.id} className="ml-6">
                                    <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-[--color-primary] text-[--color-text-primary]">
                                        {timelineIcons[evt.action] ?? <Clock size={12} />}
                                    </span>
                                    <p className="text-sm font-medium text-[--color-text-primary]">{evt.action}</p>
                                    <p className="text-xs text-[--color-text-muted]">
                                        {evt.actor} · {formatDateTime(evt.timestamp)}
                                    </p>
                                    {evt.note && (
                                        <p className="text-xs text-[--color-text-muted] mt-1 italic">{evt.note}</p>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </Card>
                </div>

                {/* Actions sidebar */}
                <div className="space-y-4">
                    <Card>
                        <h3 className="text-sm font-semibold text-[--color-text-primary] mb-4">Actions</h3>
                        <div className="space-y-2">
                            <Button variant="ghost" className="w-full justify-start" leftIcon={<Download size={15} />}>
                                Download PDF
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                leftIcon={<RefreshCw size={15} />}
                                onClick={() => requestVerification.mutate(doc.id)}
                            >
                                Request Re-verification
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
