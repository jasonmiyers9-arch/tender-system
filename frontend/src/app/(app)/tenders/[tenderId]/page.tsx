'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useTender } from '@/lib/hooks/useTenders';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate } from '@/lib/utils/formatters';
import { Calendar, Building2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function TenderDetailPage({ params }: { params: Promise<{ tenderId: string }> }) {
    const { tenderId } = use(params);
    const router = useRouter();
    const { data: tender, isLoading, isError, refetch } = useTender(tenderId);

    if (isLoading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
    if (isError || !tender) return <ErrorState onRetry={refetch} />;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default">{tender.category}</Badge>
                        <Badge
                            variant={tender.matchScore >= 85 ? 'success' : tender.matchScore >= 65 ? 'warning' : 'danger'}
                        >
                            {tender.matchScore}% Match
                        </Badge>
                    </div>
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">{tender.title}</h1>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[--color-text-muted]">
                        <span className="flex items-center gap-1"><Building2 size={13} />{tender.organization}</span>
                        <span className="flex items-center gap-1"><Calendar size={13} />Deadline: {formatDate(tender.deadline)}</span>
                        <span>{tender.value}</span>
                    </div>
                </div>
                <Button rightIcon={<ArrowRight size={15} />} onClick={() => router.push(`/tenders/${tenderId}/apply`)}>
                    Apply Now
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Description</h3>}>
                        <p className="text-sm text-[--color-text-primary] leading-relaxed">{tender.description}</p>
                    </Card>

                    <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Requirements</h3>}>
                        <ul className="space-y-2">
                            {tender.requirements.map((req) => (
                                <li key={req} className="flex items-start gap-2 text-sm text-[--color-text-primary]">
                                    <CheckCircle2 size={14} className="text-[--color-success] mt-0.5 flex-shrink-0" />
                                    {req}
                                </li>
                            ))}
                        </ul>
                    </Card>

                    <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Eligibility Criteria</h3>}>
                        <ul className="space-y-2">
                            {tender.eligibilityCriteria.map((c) => (
                                <li key={c} className="flex items-start gap-2 text-sm text-[--color-text-primary]">
                                    <CheckCircle2 size={14} className="text-[--color-primary] mt-0.5 flex-shrink-0" />
                                    {c}
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>

                <div className="space-y-4">
                    {tender.gaps.length > 0 && (
                        <Card>
                            <h3 className="text-sm font-semibold text-[--color-text-primary] mb-3 flex items-center gap-2">
                                <AlertCircle size={15} className="text-[--color-warning]" /> Compliance Gaps
                            </h3>
                            <ul className="space-y-2">
                                {tender.gaps.map((g) => (
                                    <li key={g} className="flex items-start gap-2 text-xs text-[--color-text-muted]">
                                        <AlertCircle size={12} className="text-[--color-warning] mt-0.5 flex-shrink-0" />
                                        {g}
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}

                    <Card>
                        <h3 className="text-sm font-semibold text-[--color-text-primary] mb-3">
                            Recommended Documents
                        </h3>
                        <ul className="space-y-2">
                            {tender.recommendedDocuments.map((d) => (
                                <li key={d} className="text-xs text-[--color-text-muted] flex items-center gap-2">
                                    <ArrowRight size={12} className="text-[--color-primary]" /> {d}
                                </li>
                            ))}
                        </ul>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full mt-4"
                            onClick={() => router.push('/vault')}
                        >
                            Upload Missing Docs
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    );
}
