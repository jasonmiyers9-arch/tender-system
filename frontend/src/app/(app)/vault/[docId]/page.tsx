'use client';

import type { ReactNode } from 'react';
import { useReExtractDocument, useRequestVerification, useVaultDocument, useDownloadDocument } from '@/lib/hooks/useVault';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DownloadButton } from '@/components/ui/DownloadButton';
import { StatusBadge } from '@/components/badges/Badges';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate, formatDateTime, docCategoryLabel } from '@/lib/utils/formatters';
import { RefreshCw, CheckCircle, XCircle, Clock, Upload } from 'lucide-react';
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
    const reExtract = useReExtractDocument();
    const downloadDoc = useDownloadDocument();

    if (isLoading) return <CardSkeleton />;
    if (isError || !doc) return <ErrorState onRetry={refetch} />;

    const handleDownload = () => downloadDoc.mutate({ docId: doc.id, filename: doc.name });

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
                    <DownloadButton
                        ariaLabel="Download document"
                        size="sm"
                        iconSize={15}
                        onClick={handleDownload}
                        loading={downloadDoc.isPending}
                    >
                        Download
                    </DownloadButton>
                    {(doc.status === 'expired' || doc.status === 'rejected') && (
                        <Button
                            leftIcon={<RefreshCw size={15} />}
                            size="sm"
                            onClick={() => requestVerification.mutate(doc.id)}
                            loading={requestVerification.isPending}
                        >
                            Renew
                        </Button>
                    )}
                    {doc.status === 'uploaded' && (
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
                                ['Extraction', doc.extractionStatus ?? 'skipped'],
                                ['Expiry Date', formatDate(doc.expiryDate)],
                                ['Last Updated', formatDate(doc.lastUpdated)],
                                ['File Size', doc.fileSize],
                                ['File Type', doc.fileType],
                                ...Object.entries(doc.metadata ?? {}).map(([k, v]) => [k, v]),
                            ].map(([label, value]) => (
                                <div key={String(label)}>
                                    <dt className="text-[--color-text-muted] mb-0.5">{label}</dt>
                                    <dd className="font-medium text-[--color-text-primary]">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        {doc.extractionError && (
                            <p className="mt-4 text-xs text-[--color-danger]">
                                Extraction warning: {doc.extractionError}
                            </p>
                        )}
                        {reExtract.isError && (
                            <p className="mt-2 text-xs text-[--color-danger]">
                                Re-extraction failed. Please try again.
                            </p>
                        )}
                        {downloadDoc.isError && (
                            <p className="mt-2 text-xs text-[--color-danger]">
                                Download failed. Please try again.
                            </p>
                        )}
                    </Card>

                    {(doc.extractedText || doc.aiSummary || doc.documentAnalysis) && (
                        <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Extracted Knowledge Base</h3>}>
                            <div className="space-y-4">
                                {doc.aiSummary && (
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-[--color-text-muted] mb-1">AI Summary</p>
                                        <p className="text-sm text-[--color-text-primary] leading-relaxed whitespace-pre-wrap">{doc.aiSummary}</p>
                                        {doc.aiSummaryModel && (
                                            <p className="text-[11px] text-[--color-text-muted] mt-2">
                                                Model: {doc.aiSummaryModel}
                                                {doc.aiSummaryUpdatedAt ? ` - Updated ${formatDateTime(doc.aiSummaryUpdatedAt)}` : ''}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {doc.documentAnalysis && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="rounded-lg border border-[--color-border] p-3">
                                            <p className="text-xs text-[--color-text-muted]">Word Count</p>
                                            <p className="text-sm font-semibold text-[--color-text-primary]">{doc.documentAnalysis.wordCount}</p>
                                        </div>
                                        <div className="rounded-lg border border-[--color-border] p-3">
                                            <p className="text-xs text-[--color-text-muted]">Doc Type</p>
                                            <p className="text-sm font-semibold text-[--color-text-primary]">{doc.documentAnalysis.documentType ?? 'Unknown'}</p>
                                        </div>
                                        <div className="rounded-lg border border-[--color-border] p-3">
                                            <p className="text-xs text-[--color-text-muted]">Confidence</p>
                                            <p className="text-sm font-semibold text-[--color-text-primary]">{Math.round((doc.documentAnalysis.confidence ?? 0) * 100)}%</p>
                                        </div>
                                        <div className="rounded-lg border border-[--color-border] p-3">
                                            <p className="text-xs text-[--color-text-muted]">Pages</p>
                                                <p className="text-sm font-semibold text-[--color-text-primary]">{doc.pageCount ?? '--'}</p>
                                        </div>
                                    </div>
                                )}

                                {doc.extractedText && (
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-[--color-text-muted] mb-1">Extracted Text</p>
                                        <pre className="max-h-72 overflow-auto rounded-lg border border-[--color-border] bg-[--color-bg] p-3 text-xs text-[--color-text-primary] whitespace-pre-wrap">
                                            {doc.extractedText}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Timeline */}
                    <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Status Timeline</h3>}>
                        <ol className="relative border-l border-[--color-border] ml-3 space-y-6">
                            {(doc.timeline ?? []).map((evt) => (
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
                            <DownloadButton
                                className="w-full justify-start"
                                ariaLabel="Download PDF"
                                iconSize={15}
                                onClick={handleDownload}
                                loading={downloadDoc.isPending}
                            >
                                Download PDF
                            </DownloadButton>
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                leftIcon={<RefreshCw size={15} />}
                                onClick={() => requestVerification.mutate(doc.id)}
                            >
                                Request Re-verification
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                leftIcon={<RefreshCw size={15} />}
                                onClick={() => reExtract.mutate(doc.id)}
                                loading={reExtract.isPending}
                            >
                                Re-extract Text
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
