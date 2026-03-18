'use client';

import { use } from 'react';
import { useVerifyCompany } from '@/lib/hooks/useVerify';
import { useUploadDocument } from '@/lib/hooks/useVault'; // Reusing mutation for mock action
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ScoreBandBadge, StatusBadge } from '@/components/badges/Badges';
import { CardSkeleton, TableRowSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate, docCategoryLabel, formatDateTime } from '@/lib/utils/formatters';
import { Download, Building2, CheckCircle2, ShieldAlert, FileText, CheckCircle, Clock, Upload, XCircle } from 'lucide-react';

const timelineIcons: Record<string, React.ReactNode> = {
    'Document uploaded': <Upload size={14} />,
    'Submitted for verification': <Clock size={14} />,
    'Verified': <CheckCircle size={14} />,
    'Rejected': <XCircle size={14} />,
    'Score recalculated': <Building2 size={14} />,
    'Company profile updated': <FileText size={14} />,
    'Document verified': <CheckCircle size={14} />,
    'Document rejected': <XCircle size={14} />,
};

export default function VerifyCompanyReportPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = use(params);
    const { data: report, isLoading, isError, refetch } = useVerifyCompany(companyId);

    if (isLoading) return <div className="space-y-6 max-w-5xl mx-auto"><CardSkeleton /><CardSkeleton /></div>;
    if (isError || !report) return <ErrorState onRetry={refetch} />;

    const { company, score, documentsByCategory, auditLog } = report;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header Profile */}
            <Card padding="lg">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-[--color-text-primary]">{company.name}</h1>
                            {company.status === 'verified' && (
                                <Badge variant="success" size="sm" className="hidden sm:inline-flex">CIPC Verified</Badge>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 mt-4 text-sm">
                            <p><span className="text-[--color-text-muted]">Reg No:</span> {company.registrationNumber}</p>
                            <p><span className="text-[--color-text-muted]">VAT No:</span> {company.vatNumber}</p>
                            <p><span className="text-[--color-text-muted]">Industry:</span> {company.industry}</p>
                        </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-3 flex-shrink-0 bg-[--color-bg] p-4 rounded-xl border border-[--color-border]">
                        <p className="text-xs font-semibold uppercase tracking-widest text-[--color-text-muted]">Readiness Score</p>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl font-bold text-[--color-text-primary]">{score.score}</span>
                            <ScoreBandBadge band={score.band} />
                        </div>
                        <Button size="sm" leftIcon={<Download size={14} />} className="w-full mt-2">
                            Download Full Report
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Compliance Details */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-lg font-bold text-[--color-text-primary]">Compliance Documents</h2>

                    {Object.entries(documentsByCategory).map(([category, docs]) => {
                        if (!docs || docs.length === 0) return null;
                        return (
                            <Card key={category} padding="none" header={<h3 className="text-sm font-semibold capitalize text-[--color-text-primary] flex items-center gap-2"><FileText size={16} className="text-[--color-primary]" /> {docCategoryLabel(category)}</h3>}>
                                <ul className="divide-y divide-[--color-border]">
                                    {docs.map(doc => (
                                        <li key={doc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[--color-bg] transition-colors">
                                            <div>
                                                <p className="text-sm font-medium text-[--color-text-primary]">{doc.name}</p>
                                                <p className="text-xs text-[--color-text-muted] mt-1">
                                                    Expires: {doc.expiryDate ? formatDate(doc.expiryDate) : 'N/A'} • Last updated: {formatDate(doc.lastUpdated)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <StatusBadge status={doc.status} />
                                                <Button variant="ghost" size="sm">View</Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        )
                    })}
                </div>

                {/* Audit Log column */}
                <div className="space-y-6">
                    <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Recent Audit Log</h3>} padding="none">
                        <ol className="p-5 space-y-6">
                            {auditLog.map((evt) => (
                                <li key={evt.id} className="relative pl-6 border-l border-[--color-border] last:border-0 last:pb-0">
                                    <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-[--color-surface] border border-[--color-border] text-[--color-text-muted] shadow-sm">
                                        {timelineIcons[evt.action] ?? <Clock size={12} />}
                                    </span>
                                    <div className="-mt-1">
                                        <p className="text-sm font-medium text-[--color-text-primary]">{evt.action}</p>
                                        <p className="text-xs text-[--color-text-muted] mt-0.5">
                                            <span className="font-medium">{evt.actor}</span> · {formatDateTime(evt.timestamp)}
                                        </p>
                                        {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                                            <div className="mt-2 p-2 rounded bg-[--color-bg] border border-[--color-border] text-[11px] font-mono text-[--color-text-muted] break-words">
                                                {JSON.stringify(evt.metadata, null, 1).replace(/[{}"]/g, '')}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <div className="p-3 border-t border-[--color-border] text-center">
                            <Button variant="ghost" size="sm" className="w-full text-[--color-primary]">View Complete Audit Trail</Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
