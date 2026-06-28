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
import { Calendar, Building2, CheckCircle2, AlertCircle, ArrowRight, Bot, Clock, FileCheck, MapPin, Users } from 'lucide-react';


function documentLabel(category: string): string {
    const labels: Record<string, string> = {
        tax: 'Tax compliance / SARS TCS',
        registration: 'Company registration / CIPC / CSD',
        bbbee: 'B-BBEE certificate or affidavit',
        financial: 'Financial statements / bank confirmation',
        legal: 'Legal, insurance or good standing documents',
        certification: 'Industry certification / CIDB / ISO',
        policy: 'Policy documents',
    };
    return labels[category] ?? category.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
export default function TenderDetailPage({ params }: { params: Promise<{ tenderId: string }> }) {
    const { tenderId } = use(params);
    const router = useRouter();
    const { data: tender, isLoading, isError, refetch } = useTender(tenderId);

    if (isLoading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
    if (isError || !tender) return <ErrorState onRetry={refetch} />;
    const requiredDocuments = Array.from(new Set([
        ...(tender.required_categories ?? []),
        ...(tender.recommendedDocuments ?? []),
    ].filter(Boolean)));
    const matchLabel = tender.matchScore >= 85 ? 'Strong Match' : tender.matchScore >= 65 ? 'Matched' : 'Low Match';

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default">{tender.category}</Badge>
                        <Badge
                            variant={tender.matchScore >= 85 ? 'success' : tender.matchScore >= 65 ? 'warning' : 'danger'}
                        >
                            {matchLabel}
                        </Badge>
                    </div>
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">{tender.title}</h1>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[--color-text-muted]">
                        <span className="flex items-center gap-1"><Building2 size={13} />{tender.organization}</span>
                        <span className="flex items-center gap-1"><Calendar size={13} />Closing: {formatDate(tender.deadline)}{tender.closingTime ? ` at ${tender.closingTime}` : ''}</span>
                        <span>{tender.value}</span>
                    </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                    <Button
                        variant="secondary"
                        leftIcon={<Bot size={15} />}
                        onClick={() => router.push(`/assistant?tenderId=${encodeURIComponent(tenderId)}`)}
                    >
                        Check with AI
                    </Button>
                    <Button rightIcon={<ArrowRight size={15} />} onClick={() => router.push(`/tenders/${tenderId}/apply`)}>
                        Apply Now
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <Card padding="sm">
                    <p className="text-[10px] uppercase font-semibold text-[--color-text-muted] mb-1">Briefing Meeting</p>
                    <p className="text-sm font-medium text-[--color-text-primary] flex items-center gap-2">
                        <Users size={14} /> {tender.briefing?.hasBriefingSession ? `${tender.briefing.date || 'Date TBC'}${tender.briefing.venue ? `, ${tender.briefing.venue}` : ''}` : 'Not specified'}
                    </p>
                </Card>
                <Card padding="sm">
                    <p className="text-[10px] uppercase font-semibold text-[--color-text-muted] mb-1">Tender Closing Date</p>
                    <p className="text-sm font-medium text-[--color-text-primary] flex items-center gap-2">
                        <Clock size={14} /> {formatDate(tender.deadline)}{tender.closingTime ? ` at ${tender.closingTime}` : ''}
                    </p>
                </Card>
                <Card padding="sm">
                    <p className="text-[10px] uppercase font-semibold text-[--color-text-muted] mb-1">Required At</p>
                    <p className="text-sm font-medium text-[--color-text-primary] flex items-center gap-2">
                        <MapPin size={14} /> {tender.requiredAt || tender.location || 'Not specified'}
                    </p>
                </Card>
                <Card padding="sm">
                    <p className="text-[10px] uppercase font-semibold text-[--color-text-muted] mb-1">Department / Category</p>
                    <p className="text-sm font-medium text-[--color-text-primary]">{tender.organization}</p>
                    <p className="text-xs text-[--color-text-muted] mt-1">{tender.category}</p>
                </Card>
            </div>

            {tender.recommendationReason && (
                <Card padding="sm">
                    <p className="text-sm font-medium text-[--color-text-primary]">{tender.recommendationReason}</p>
                </Card>
            )}

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
                            Required Documents
                        </h3>
                        <ul className="space-y-2">
                            {(requiredDocuments.length ? requiredDocuments : tender.recommendedDocuments).map((d) => (
                                <li key={d} className="text-xs text-[--color-text-muted] flex items-center gap-2">
                                    <FileCheck size={12} className="text-[--color-primary]" /> {documentLabel(d)}
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
