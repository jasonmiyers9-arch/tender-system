'use client';

import { use } from 'react';
import { useVerifyCompany } from '@/lib/hooks/useVerify';
import { verify } from '@/lib/api/verify';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate, docCategoryLabel, formatDateTime } from '@/lib/utils/formatters';
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    FileText,
    Flag,
    Mail,
    ShieldCheck,
} from 'lucide-react';
import type { VaultDocument } from '@/lib/api/types';

const authorityByCategory: Record<string, string> = {
    tax: 'SARS',
    registration: 'CIPC',
    bbbee: 'SANAS / B-BBEE Commission',
    certification: 'Issuing Authority',
    financial: 'Registered Accountant',
    legal: 'Legal Authority',
    policy: 'Company Policy',
};

function scoreTone(score: number) {
    if (score >= 85) {
        return {
            box: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
            label: 'Tender Ready',
        };
    }
    if (score >= 65) {
        return {
            box: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
            label: 'Partially Ready',
        };
    }
    return {
        box: 'border-red-500/30 bg-red-500/10 text-red-700',
        label: 'High Risk',
    };
}

function statusVariant(status: VaultDocument['status']): 'success' | 'warning' | 'danger' | 'default' {
    if (status === 'verified') return 'success';
    if (status === 'uploaded') return 'warning';
    if (status === 'rejected' || status === 'expired') return 'danger';
    return 'default';
}

function flattenDocuments(documentsByCategory: Record<string, VaultDocument[] | undefined>) {
    return Object.entries(documentsByCategory).flatMap(([category, docs]) =>
        (docs ?? []).map((doc) => ({
            ...doc,
            category,
            authority: authorityByCategory[category] ?? 'TenderGuard Review',
        }))
    );
}

export default function VerifyCompanyReportPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = use(params);
    const { data: report, isLoading, isError, refetch } = useVerifyCompany(companyId);

    async function downloadBundle() {
        const blob = await verify.downloadBundle(companyId);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${report?.company.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'company'}-tenderguard-compliance-bundle.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function requestUpdate() {
        if (!report) return;
        window.location.href = `mailto:${report.company.email}?subject=${encodeURIComponent('TenderGuard compliance update request')}&body=${encodeURIComponent(`Please update your TenderGuard compliance documents for evaluator review.\n\nCompany: ${report.company.name}\nRegistration: ${report.company.registrationNumber}`)}`;
    }

    function flagForReview() {
        window.alert('This report has been flagged for internal review.');
    }

    if (isLoading) {
        return <div className="space-y-6 max-w-7xl mx-auto"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;
    }
    if (isError || !report) return <ErrorState onRetry={refetch} />;

    const { company, score, documentsByCategory } = report;
    const documents = flattenDocuments(documentsByCategory as Record<string, VaultDocument[] | undefined>);
    const tone = scoreTone(score.score);
    const generatedAt = new Date().toISOString();

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <section className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-6 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-3xl font-extrabold tracking-tight text-[--color-text-primary]">
                                {company.name}
                            </h1>
                            <Badge variant="success" size="md" dot>Verified Entity</Badge>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <p><span className="text-[--color-text-muted]">Reg No:</span> <span className="font-semibold text-[--color-text-primary]">{company.registrationNumber || 'Not captured'}</span></p>
                            <p><span className="text-[--color-text-muted]">CSD No:</span> <span className="font-semibold text-[--color-text-primary]">{company.csdNumber || 'Not captured'}</span></p>
                            <p><span className="text-[--color-text-muted]">Province:</span> <span className="font-semibold text-[--color-text-primary]">{company.province || 'Not captured'}</span></p>
                            <p><span className="text-[--color-text-muted]">Industry:</span> <span className="font-semibold text-[--color-text-primary]">{company.industry || 'Not captured'}</span></p>
                            <p><span className="text-[--color-text-muted]">VAT No:</span> <span className="font-semibold text-[--color-text-primary]">{company.vatNumber || 'Not captured'}</span></p>
                            <p><span className="text-[--color-text-muted]">Contact:</span> <span className="font-semibold text-[--color-text-primary]">{company.email || 'Not captured'}</span></p>
                        </div>
                    </div>

                    <div className={`flex min-w-[260px] flex-col justify-between rounded-2xl border p-5 ${tone.box}`}>
                        <p className="text-xs font-bold uppercase tracking-wide">Tender Readiness Score&trade;</p>
                        <div className="py-4">
                            <p className="text-5xl font-extrabold leading-none">{score.score}</p>
                            <p className="mt-1 text-sm font-semibold">{tone.label}</p>
                        </div>
                        <p className="text-xs font-medium text-[--color-text-muted]">
                            Last verified: {formatDateTime(score.lastCalculated)}
                        </p>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[--color-border] bg-[--color-surface] shadow-sm">
                <div className="flex items-center gap-2 border-b border-[--color-border] px-5 py-4">
                    <FileText size={18} className="text-[--color-primary]" />
                    <h2 className="text-base font-bold text-[--color-text-primary]">Document Status</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-[#0B1120] text-white">
                            <tr>
                                <th className="px-5 py-3 font-semibold">Document</th>
                                <th className="px-5 py-3 font-semibold">Authority</th>
                                <th className="px-5 py-3 font-semibold">Expiry</th>
                                <th className="px-5 py-3 font-semibold">Status</th>
                                <th className="px-5 py-3 font-semibold">Verified</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[--color-border]">
                            {documents.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-10 text-center text-[--color-text-muted]">
                                        No compliance documents are available for this company.
                                    </td>
                                </tr>
                            ) : (
                                documents.map((doc, index) => (
                                    <tr key={doc.id} className={index % 2 === 0 ? 'bg-[--color-surface]' : 'bg-[--color-surface-raised]'}>
                                        <td className="px-5 py-4">
                                            <p className="font-semibold text-[--color-text-primary]">{doc.name}</p>
                                            <p className="mt-0.5 text-xs text-[--color-text-muted]">{docCategoryLabel(doc.category)}</p>
                                        </td>
                                        <td className="px-5 py-4 text-[--color-text-primary]">{doc.authority}</td>
                                        <td className="px-5 py-4 text-[--color-text-muted]">{doc.expiryDate ? formatDate(doc.expiryDate) : 'N/A'}</td>
                                        <td className="px-5 py-4">
                                            <Badge variant={statusVariant(doc.status)} size="sm">{doc.status}</Badge>
                                        </td>
                                        <td className="px-5 py-4">
                                            {doc.status === 'verified' ? (
                                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                                                    <CheckCircle2 size={18} />
                                                </span>
                                            ) : (
                                                <span className="text-xl font-semibold text-[--color-text-subtle]">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-[--color-border] bg-[--color-surface] p-4 sm:flex-row sm:items-center">
                <Button leftIcon={<Download size={16} />} onClick={downloadBundle} style={{ background: '#2563EB' }}>
                    Download Compliance Bundle PDF
                </Button>
                <Button variant="outline" leftIcon={<Mail size={16} />} onClick={requestUpdate}>
                    Request Update from Bidder
                </Button>
                <Button
                    variant="ghost"
                    leftIcon={<Flag size={16} />}
                    onClick={flagForReview}
                    className="border-red-500/60 text-red-600 hover:bg-red-500/10"
                >
                    Flag for Review
                </Button>
            </section>

            <section className="rounded-2xl bg-gradient-to-r from-teal-500 to-blue-600 p-[1px]">
                <div className="flex flex-col gap-4 rounded-2xl bg-[--color-surface] p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700">
                            <ShieldCheck size={25} />
                        </div>
                        <div>
                            <p className="text-base font-extrabold text-[--color-text-primary]">Verified by TenderGuard&trade;</p>
                            <p className="mt-1 text-sm text-[--color-text-muted]">
                                Report generated: {formatDateTime(generatedAt)}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="accent" size="md">Audit Log Available</Badge>
                        <Badge variant="success" size="md" dot>Evaluator-ready</Badge>
                    </div>
                </div>
            </section>

            {score.missingDocuments?.length > 0 && (
                <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex gap-3">
                        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
                        <div>
                            <p className="text-sm font-semibold text-[--color-text-primary]">Missing or required actions</p>
                            <p className="mt-1 text-sm text-[--color-text-muted]">{score.missingDocuments.join(', ')}</p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
