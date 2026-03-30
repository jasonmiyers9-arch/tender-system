'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Calendar, CheckCircle2, ClipboardCheck } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useTender, useTenderReadiness } from '@/lib/hooks/useTenders';
import { formatDate } from '@/lib/utils/formatters';

export default function TenderApplyWorkflowPage({ params }: { params: Promise<{ tenderId: string }> }) {
    const { tenderId } = use(params);
    const router = useRouter();
    const { data: tender, isLoading, isError, refetch } = useTender(tenderId);
    const readinessQuery = useTenderReadiness(tenderId);
    const [submitting, setSubmitting] = useState(false);

    const checklist = useMemo(() => {
        const ready = readinessQuery.data;
        if (!ready) return [] as Array<{ label: string; done: boolean }>;

        return ready.checklist.map((item) => ({
            label: item.item,
            done: item.status === 'passed',
        }));
    }, [readinessQuery.data]);

    const canSubmit = readinessQuery.data?.readyToSubmit ?? false;

    const handleSubmitApplication = async () => {
        if (!canSubmit) {
            window.alert('Please fix compliance gaps before submitting this application.');
            return;
        }

        try {
            setSubmitting(true);
            await new Promise((resolve) => setTimeout(resolve, 600));
            window.alert('Application workflow completed. Next step: final submission pack review.');
            router.push(`/tenders/${tenderId}`);
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
                        <Badge variant={tender.matchScore >= 85 ? 'success' : tender.matchScore >= 65 ? 'warning' : 'danger'}>
                            {tender.matchScore}% Match
                        </Badge>
                        <Badge variant={(readinessQuery.data?.readinessScore ?? 0) >= 85 ? 'success' : (readinessQuery.data?.readinessScore ?? 0) >= 65 ? 'warning' : 'danger'}>
                            {(readinessQuery.data?.readinessScore ?? 0)}% Ready
                        </Badge>
                    </div>
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">{tender.title}</h1>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[--color-text-muted]">
                        <span className="flex items-center gap-1"><Building2 size={13} />{tender.organization}</span>
                        <span className="flex items-center gap-1"><Calendar size={13} />Deadline: {formatDate(tender.deadline)}</span>
                        <span>{tender.value}</span>
                    </div>
                </div>
            </div>

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
