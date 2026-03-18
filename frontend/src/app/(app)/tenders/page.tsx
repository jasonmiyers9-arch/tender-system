'use client';

import { useState } from 'react';
import { useTenderMatches } from '@/lib/hooks/useTenders';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/utils/formatters';
import { FileSearch, Calendar, Building2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function TendersPage() {
    const { data: matches, isLoading, isError, refetch } = useTenderMatches();

    if (isLoading)
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
        );
    if (isError) return <ErrorState onRetry={refetch} />;
    if (!matches?.length)
        return (
            <EmptyState
                icon={<FileSearch size={28} />}
                title="No tender matches found"
                description="Upload more compliance documents to unlock tender match recommendations."
            />
        );

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-[--color-text-primary]">Tender Matches</h1>
                <p className="text-sm text-[--color-text-muted] mt-0.5">
                    {matches.length} opportunities matched to your compliance profile
                </p>
            </div>

            <div className="space-y-4">
                {matches.map((t) => (
                    <Link key={t.id} href={`/tenders/${t.id}`}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer" padding="none">
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="default" size="sm">{t.category}</Badge>
                                        </div>
                                        <h2 className="text-base font-semibold text-[--color-text-primary]">
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
