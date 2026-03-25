'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import {
    useProviderApplications,
    useApproveApplication,
    useRejectApplication,
    useApplicationCompanyDocuments,
} from '@/lib/hooks/useApplications';
import { applicationsApi } from '@/lib/api/applications';
import { formatDate, formatDateTime } from '@/lib/utils/formatters';
import { ClipboardList, FileText, X, CheckCircle2, AlertTriangle, Clock, XCircle, Download } from 'lucide-react';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

function statusVariant(status: string) {
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'danger';
    return 'warning';
}

function docStatusIcon(status: string) {
    if (status === 'verified') return <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />;
    if (status === 'rejected' || status === 'expired') return <XCircle size={13} className="text-red-500 flex-shrink-0" />;
    return <Clock size={13} className="text-yellow-500 flex-shrink-0" />;
}

function docStatusVariant(status: string): 'success' | 'danger' | 'warning' | 'default' {
    if (status === 'verified') return 'success';
    if (status === 'rejected' || status === 'expired') return 'danger';
    return 'warning';
}

function DocumentsModal({ appId, onClose }: { appId: string; onClose: () => void }) {
    const { data, isLoading, isError } = useApplicationCompanyDocuments(appId);
    const [downloading, setDownloading] = useState<string | null>(null);

    const handleDownload = async (docId: string, filename: string) => {
        setDownloading(docId);
        try {
            await applicationsApi.downloadDocument(appId, docId, filename);
        } catch {
            window.alert('Download failed. The file may no longer be available.');
        } finally {
            setDownloading(null);
        }
    };

    const CATEGORY_LABELS: Record<string, string> = {
        tax: 'Tax', registration: 'Registration', bbbee: 'B-BBEE',
        certification: 'Certification', financial: 'Financial', legal: 'Legal',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-[--color-surface] border border-[--color-border] rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[--color-border]">
                    <div>
                        <h2 className="text-base font-semibold text-[--color-text-primary]">
                            {data ? data.companyName : 'Company Documents'}
                        </h2>
                        {data && (
                            <p className="text-xs text-[--color-text-muted] mt-0.5">Applied by {data.appliedBy}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-[--color-text-muted] hover:text-[--color-text-primary] p-1 rounded">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-5">
                    {isLoading && (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-12 rounded-lg bg-[--color-bg] animate-pulse" />
                            ))}
                        </div>
                    )}
                    {isError && (
                        <div className="flex items-center gap-2 text-sm text-[--color-danger]">
                            <AlertTriangle size={16} /> Failed to load documents.
                        </div>
                    )}
                    {data && data.documents.length === 0 && (
                        <div className="text-center py-8 text-sm text-[--color-text-muted]">
                            This company has not uploaded any documents yet.
                        </div>
                    )}
                    {data && data.documents.length > 0 && (
                        <div className="space-y-2">
                            {data.documents.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[--color-border] bg-[--color-bg]"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <FileText size={15} className="text-[--color-text-muted] flex-shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-[--color-text-primary] truncate">{doc.name}</p>
                                            <p className="text-xs text-[--color-text-muted]">
                                                {CATEGORY_LABELS[doc.category] ?? doc.category}
                                                {doc.expiryDate && ` · Expires ${formatDate(doc.expiryDate)}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {docStatusIcon(doc.status)}
                                        <Badge variant={docStatusVariant(doc.status)} size="sm">{doc.status}</Badge>
                                        <button
                                            onClick={() => handleDownload(doc.id, doc.name)}
                                            disabled={downloading === doc.id}
                                            className="p-1 rounded hover:bg-[--color-border] text-[--color-text-muted] hover:text-[--color-primary] disabled:opacity-50 transition-colors"
                                            title="Download document"
                                        >
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ProviderApplicationsPage() {
    const { data: apps, isLoading, isError, isFetching, refetch } = useProviderApplications();
    const approve = useApproveApplication();
    const reject = useRejectApplication();
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [actionId, setActionId] = useState<string | null>(null);
    const [docsAppId, setDocsAppId] = useState<string | null>(null);

    const filtered = (apps ?? []).filter((a) => filter === 'all' ? true : a.status === filter);
    const pendingCount = (apps ?? []).filter((a) => a.status === 'pending').length;

    const handleApprove = async (appId: string) => {
        setActionId(appId);
        try { await approve.mutateAsync(appId); } finally { setActionId(null); }
    };

    const handleReject = async (appId: string) => {
        const reason = window.prompt('Rejection reason (optional):') ?? undefined;
        setActionId(appId);
        try { await reject.mutateAsync({ appId, reason }); } finally { setActionId(null); }
    };

    if (isLoading || (isError && isFetching)) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto">
                <h1 className="text-2xl font-bold text-[--color-text-primary]">Applications</h1>
                <Card padding="none">
                    <table className="w-full"><tbody>{[1,2,3].map(i => <TableRowSkeleton key={i} cols={6} />)}</tbody></table>
                </Card>
            </div>
        );
    }

    if (isError) return <ErrorState onRetry={refetch} />;

    return (
        <>
            {docsAppId && <DocumentsModal appId={docsAppId} onClose={() => setDocsAppId(null)} />}

            <div className="space-y-6 max-w-7xl mx-auto">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[--color-text-primary]">Applications</h1>
                        <p className="text-sm text-[--color-text-muted] mt-0.5">Review and approve company applications for your tenders.</p>
                    </div>
                    {pendingCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-50 border border-yellow-200">
                            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                            <span className="text-sm font-medium text-yellow-800">{pendingCount} pending review</span>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                        <Button key={s} size="sm" variant={filter === s ? 'primary' : 'ghost'} onClick={() => setFilter(s)}>
                            {s}{s === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                        </Button>
                    ))}
                </div>

                {!filtered.length ? (
                    <Card>
                        <EmptyState
                            icon={<ClipboardList size={28} />}
                            title="No applications"
                            description={filter === 'all' ? 'No companies have applied to your tenders yet.' : `No ${filter} applications.`}
                        />
                    </Card>
                ) : (
                    <Card padding="none">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[--color-bg] border-b border-[--color-border]">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Company</th>
                                        <th className="px-4 py-3 font-semibold">Tender</th>
                                        <th className="px-4 py-3 font-semibold">Deadline</th>
                                        <th className="px-4 py-3 font-semibold">Applied</th>
                                        <th className="px-4 py-3 font-semibold">Status</th>
                                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[--color-border]">
                                    {filtered.map((a) => (
                                        <tr key={a.id} className={`bg-[--color-surface] ${a.status === 'pending' ? 'border-l-2 border-l-yellow-400' : ''}`}>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-[--color-text-primary]">{a.companyName}</p>
                                                <p className="text-xs text-[--color-text-muted]">{a.appliedBy}</p>
                                            </td>
                                            <td className="px-4 py-3 text-[--color-text-primary]">{a.tenderTitle}</td>
                                            <td className="px-4 py-3 text-[--color-text-muted]">{formatDate(a.tenderDeadline)}</td>
                                            <td className="px-4 py-3 text-[--color-text-muted]">{formatDateTime(a.appliedAt)}</td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-0.5">
                                                    <Badge variant={statusVariant(a.status)} size="sm">{a.status}</Badge>
                                                    {a.reviewedBy && (
                                                        <p className="text-xs text-[--color-text-muted]">by {a.reviewedBy}</p>
                                                    )}
                                                    {a.rejectionReason && (
                                                        <p className="text-xs text-[--color-danger]">{a.rejectionReason}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setDocsAppId(a.id)}
                                                    >
                                                        View Docs
                                                    </Button>
                                                    {a.status !== 'approved' && (
                                                        <Button
                                                            size="sm"
                                                            loading={actionId === a.id && approve.isPending}
                                                            onClick={() => handleApprove(a.id)}
                                                        >
                                                            Approve
                                                        </Button>
                                                    )}
                                                    {a.status !== 'rejected' && (
                                                        <Button
                                                            size="sm"
                                                            variant="danger"
                                                            loading={actionId === a.id && reject.isPending}
                                                            onClick={() => handleReject(a.id)}
                                                        >
                                                            Reject
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
        </>
    );
}
