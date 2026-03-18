'use client';

import Link from 'next/link';
import { Calendar, Download, AlertTriangle } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useTenderCalendar } from '@/lib/hooks/useTenders';
import { formatDate } from '@/lib/utils/formatters';
import { tenders } from '@/lib/api/tenders';

export default function TenderCalendarPage() {
    const query = useTenderCalendar();

    if (query.isLoading) return <CardSkeleton />;
    if (query.isError) return <ErrorState onRetry={query.refetch} message="Unable to load tender calendar." />;

    const items = query.data ?? [];

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">Tender Calendar & Deadlines</h1>
                    <p className="text-sm text-[--color-text-muted] mt-1">Track upcoming tender deadlines and export to calendar.</p>
                </div>
                <Button
                    variant="secondary"
                    leftIcon={<Download size={14} />}
                    onClick={() => tenders.downloadCalendarIcs()}
                >
                    Export ICS
                </Button>
            </div>

            <Card>
                {items.length === 0 ? (
                    <p className="text-sm text-[--color-text-muted]">No tender deadlines available yet.</p>
                ) : (
                    <ul className="space-y-3">
                        {items.map((item) => (
                            <li key={item.id}>
                                <Link
                                    href={`/tenders/${item.id.replace('tender-', '')}`}
                                    className="flex items-center justify-between gap-4 p-3 rounded-lg border border-[--color-border] bg-[--color-bg] hover:bg-[--color-surface] transition-colors"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-[--color-text-primary] flex items-center gap-2">
                                            <Calendar size={14} className="text-[--color-primary]" /> {item.title}
                                        </p>
                                        <p className="text-xs text-[--color-text-muted] mt-1">
                                            {item.organization} • Deadline: {formatDate(item.date)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.gapsCount > 0 && (
                                            <Badge variant="warning" size="sm">
                                                <AlertTriangle size={11} className="mr-1" /> {item.gapsCount} gaps
                                            </Badge>
                                        )}
                                        <Badge variant={item.matchScore >= 85 ? 'success' : item.matchScore >= 65 ? 'warning' : 'danger'} size="sm">
                                            {item.matchScore}%
                                        </Badge>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}
