'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Calendar, CheckCircle2, ClipboardCheck, Download, FileArchive, FileCheck, FileText, Shield, Building, History, Target, Info } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useTender, useTenderReadiness } from '@/lib/hooks/useTenders';
import { tenders } from '@/lib/api/tenders';
import { applicationsApi } from '@/lib/api/applications';
import { formatDate } from '@/lib/utils/formatters';

// Score dimension configuration with max points and icons
const SCORE_DIMENSIONS = [
    { key: 'documentCompleteness', label: 'Document Completeness', max: 30, icon: FileCheck, color: '#3B82F6', description: 'Valid documents uploaded for your sector' },
    { key: 'verificationCoverage', label: 'Verification Coverage', max: 25, icon: Shield, color: '#10B981', description: 'Documents verified by evaluators' },
    { key: 'csdProfileCompleteness', label: 'CSD Profile', max: 20, icon: Building, color: '#8B5CF6', description: 'Company profile fields completed' },
    { key: 'complianceConsistency', label: 'Compliance History', max: 15, icon: History, color: '#F59E0B', description: 'No expired documents in past 12 months' },
    { key: 'tenderFitBonus', label: 'Tender Fit', max: 10, icon: Target, color: '#EC4899', description: 'Required documents for this tender' },
] as const;

export default function TenderApplyWorkflowPage({ params }: { params: Promise<{ tenderId: string }> }) {
    const { tenderId } = use(params);
    const router = useRouter();
    const { data: tender, isLoading, isError, refetch } = useTender(tenderId);
    const readinessQuery = useTenderReadiness(tenderId);
    const [submitting, setSubmitting] = useState(false);
    const [generatingSbd, setGeneratingSbd] = useState(false);
    const [generatingBidPack, setGeneratingBidPack] = useState(false);

    const checklist = useMemo(() => {
        const ready = readinessQuery.data;
        if (!ready) return [] as Array<{ label: string; done: boolean }>;

        return ready.checklist.map((item) => ({
            label: item.item,
            done: item.status === 'passed',
        }));
    }, [readinessQuery.data]);

    const canSubmit = readinessQuery.data?.readyToSubmit ?? false;
    const readinessScore = readinessQuery.data?.readinessScore ?? 0;
    const scoreBreakdown = readinessQuery.data?.scoreBreakdown;

    // Calculate match score reasoning based on tender requirements vs company docs
    const matchReasons = useMemo(() => {
        if (!tender || !readinessQuery.data) return [];
        const reasons: string[] = [];
        const requiredDocs = tender.required_categories ?? tender.recommendedDocuments ?? [];
        const missingCats = readinessQuery.data.missingCategories ?? [];
        const gapCount = readinessQuery.data.blockers?.length ?? 0;

        if (missingCats.length > 0) {
            reasons.push(`Missing ${missingCats.length} of ${requiredDocs.length} required document types`);
        }
        if (gapCount > 0) {
            reasons.push(`${gapCount} compliance gaps need resolution`);
        }
        if (scoreBreakdown) {
            if (scoreBreakdown.verificationCoverage < 25) {
                reasons.push('Document verification incomplete');
            }
            if (scoreBreakdown.csdProfileCompleteness < 20) {
                reasons.push('Company profile needs completion');
            }
        }
        if (reasons.length === 0 && readinessScore >= 85) {
            reasons.push('All requirements met - ready to submit');
        }
        return reasons;
    }, [tender, readinessQuery.data, scoreBreakdown, readinessScore]);

    const handleDownloadBidPack = async () => {
        try {
            setGeneratingBidPack(true);
            await tenders.downloadBidPack(tenderId);
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Failed to generate bid pack');
        } finally {
            setGeneratingBidPack(false);
        }
    };
    const handleDownloadSbdPack = async () => {
        try {
            setGeneratingSbd(true);
            await tenders.downloadSbdPack(tenderId);
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Failed to generate SBD pack');
        } finally {
            setGeneratingSbd(false);
        }
    };
    const handleSubmitApplication = async () => {
        if (!canSubmit) {
            window.alert('Please fix compliance gaps before submitting this application.');
            return;
        }

        try {
            setSubmitting(true);
            await applicationsApi.apply(tenderId);
            window.alert('Application submitted. You can track it under My Applications.');
            router.push('/applications');
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Failed to submit application');
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
    if (isError || !tender) return <ErrorState onRetry={refetch} />;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Link href={`/tenders/${tender.id}`} className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-primary] leading-none">
                <ArrowLeft size={14} /> Back to Tender Details
            </Link>

            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default">Application Workflow</Badge>
                        <Badge variant={readinessScore >= 85 ? 'success' : readinessScore >= 65 ? 'warning' : 'danger'}>
                            {readinessScore}% Ready
                        </Badge>
                        {readinessQuery.data?.isBidReady && (
                            <Badge variant="success">Bid Ready</Badge>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">{tender.title}</h1>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[--color-text-muted]">
                        <span className="flex items-center gap-1"><Building2 size={13} />{tender.organization}</span>
                        <span className="flex items-center gap-1"><Calendar size={13} />Deadline: {formatDate(tender.deadline)}</span>
                        <span>{tender.value}</span>
                    </div>
                </div>
            </div>

            {/* Readiness Score Breakdown Card */}
            <Card header={
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[--color-text-primary]">Tender Readiness Score™ Breakdown</h3>
                    <span className="text-2xl font-bold" style={{ color: readinessScore >= 85 ? 'var(--color-success)' : readinessScore >= 65 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                        {readinessScore}/100
                    </span>
                </div>
            }>
                <div className="space-y-4">
                    {/* Score Dimension Bars */}
                    {scoreBreakdown && (
                        <div className="space-y-3">
                            {SCORE_DIMENSIONS.map(({ key, label, max, icon: Icon, color, description }) => {
                                const value = scoreBreakdown[key] ?? 0;
                                const percent = Math.round((value / max) * 100);
                                return (
                                    <div key={key}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <Icon size={14} style={{ color }} />
                                                <span className="text-sm font-medium text-[--color-text-primary]">{label}</span>
                                                <span className="text-xs text-[--color-text-muted]">({description})</span>
                                            </div>
                                            <span className="text-sm font-semibold" style={{ color: percent >= 80 ? 'var(--color-success)' : percent >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                                {value}/{max}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-[--color-border] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
                                                style={{ width: `${percent}%`, backgroundColor: color }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Score Reasoning */}
                    {matchReasons.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-[--color-border]">
                            <div className="flex items-center gap-2 mb-2">
                                <Info size={14} className="text-[--color-primary]" />
                                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">Why this score</p>
                            </div>
                            <ul className="space-y-1">
                                {matchReasons.map((reason, idx) => (
                                    <li key={idx} className="text-sm text-[--color-text-primary] flex items-start gap-2">
                                        <span className="text-[--color-text-muted]">•</span>
                                        {reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2" header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Application Checklist</h3>}>
                    <ul className="space-y-3">
                        {checklist.map((item) => (
                            <li key={item.label} className="flex items-start gap-2 text-sm text-[--color-text-primary]">
                                <CheckCircle2 size={15} className={item.done ? 'text-[--color-success] mt-0.5 flex-shrink-0' : 'text-[--color-text-muted] mt-0.5 flex-shrink-0'} />
                                {item.label}
                            </li>
                        ))}
                    </ul>

                    {(readinessQuery.data?.blockers?.length ?? 0) > 0 && (
                        <div className="mt-4 border-t border-[--color-border] pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[--color-danger] mb-2">Submission blockers</p>
                            <ul className="space-y-1">
                                {readinessQuery.data?.blockers.map((b) => (
                                    <li key={b} className="text-sm text-[--color-text-muted]">• {b}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Card>

                <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Next Actions</h3>}>
                    <div className="space-y-2">
                        <Button variant="secondary" className="w-full" onClick={() => router.push('/vault')}>
                            Upload / Fix Documents
                        </Button>
                        <Button variant="secondary" className="w-full" onClick={() => router.push('/company')}>
                            Complete Company Profile
                        </Button>
                        <Button
                            variant="success"
                            className="w-full"
                            leftIcon={<FileText size={14} />}
                            rightIcon={<Download size={14} />}
                            onClick={handleDownloadSbdPack}
                            loading={generatingSbd}
                            title="Generate pre-filled SBD forms from your company profile and vault documents"
                        >
                            Generate SBD Pack
                        </Button>
                        <Button
                            className="w-full"
                            rightIcon={<ArrowRight size={14} />}
                            onClick={handleSubmitApplication}
                            loading={submitting}
                            disabled={!canSubmit}
                            title={!canSubmit ? 'Resolve compliance gaps first' : 'Proceed with submission workflow'}
                        >
                            {canSubmit ? 'Submit Application' : 'Resolve Gaps Before Submit'}
                        </Button>
                    </div>
                </Card>
            </div>

            <Card>
                <p className="text-sm text-[--color-text-muted] inline-flex items-center gap-2">
                    <ClipboardCheck size={14} className="text-[--color-primary]" />
                    This workflow page is now the dedicated entry point for tender applications.
                </p>
            </Card>
        </div>
    );
}
