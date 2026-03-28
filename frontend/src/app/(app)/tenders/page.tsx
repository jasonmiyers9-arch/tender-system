'use client';

import { useTenderMatches } from '@/lib/hooks/useTenders';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate } from '@/lib/utils/formatters';
import { FileSearch, Calendar, Building2, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function TendersPage() {
    const { data: matches, isLoading, isError, refetch } = useTenderMatches();

    if (isLoading)
        return (
            <div className="space-y-4 max-w-5xl mx-auto">
                <div className="h-24 rounded-2xl bg-[--color-surface] animate-pulse" />
                {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
        );
    if (isError) return <ErrorState onRetry={refetch} />;
    if (!matches?.length)
        return (
            <div className="space-y-6 max-w-5xl mx-auto">
                <PageHeader
                    title="Tender Matches"
                    subtitle="Discover tenders that match your compliance profile"
                    icon={<FileSearch size={22} />}
                    iconColor="#D97706"
                />
                <EmptyState
                    icon={<FileSearch size={28} />}
                    title="No tender matches found"
                    description="Upload more compliance documents to unlock tender match recommendations."
                />
            </div>
        );

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader
                title="Tender Matches"
                subtitle={`${matches.length} opportunities matched to your compliance profile`}
                icon={<FileSearch size={22} />}
                iconColor="#D97706"
            />

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total Matches', value: matches.length, color: '#4F46E5' },
                    { label: 'High Match (85%+)', value: matches.filter(t => t.matchScore >= 85).length, color: '#059669' },
                    { label: 'With Gaps', value: matches.filter(t => t.gaps.length > 0).length, color: '#D97706' },
                ].map((s) => (
                    <Card key={s.label} padding="sm">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 rounded-full" style={{ background: s.color }} />
                            <div>
                                <p className="text-xl font-bold text-[--color-text-primary]">{s.value}</p>
                                <p className="text-[10px] text-[--color-text-muted] leading-tight">{s.label}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="space-y-3">
                {matches.map((t) => (
                    <Link key={t.id} href={`/tenders/${t.id}`} className="block group">
                        <Card className="transition-all duration-150 group-hover:scale-[1.005] group-hover:border-[--color-border-strong]" padding="none">
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="default" size="sm">{t.category}</Badge>
                                        </div>
                                        <h2 className="text-base font-semibold text-[--color-text-primary] group-hover:text-[--color-primary] transition-colors">
                                            {t.title}
                                        </h2>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[--color-text-muted]">
                                            <span className="flex items-center gap-1">
                                                <Building2 size={13} /> {t.organization}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar size={13} /> Deadline: {formatDate(t.deadline)}
                                            </span>
                                            <span>{t.value}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                        <Badge
                                            variant={t.matchScore >= 85 ? 'success' : t.matchScore >= 65 ? 'warning' : 'danger'}
                                            size="md"
                                        >
                                            {t.matchScore}% match
                                        </Badge>
                                        <ArrowRight
                                            size={14}
                                            className="text-[--color-text-muted] opacity-0 group-hover:opacity-100 transition-opacity"
                                        />
                                    </div>
                                </div>

                                {t.gaps.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-[--color-border] flex items-start gap-2">
                                        <AlertCircle size={14} className="text-[--color-warning] mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-[--color-text-muted]">
                                            Gaps: {t.gaps.join(', ')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}