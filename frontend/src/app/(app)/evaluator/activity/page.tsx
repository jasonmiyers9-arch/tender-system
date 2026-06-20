'use client';

import Link from 'next/link';
import { ExternalLink, History, RefreshCw } from 'lucide-react';
import { useEvaluatorActivity } from '@/lib/hooks/useVerify';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils/formatters';

export default function EvaluatorActivityPage() {
    const query = useEvaluatorActivity();
    if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
    const events = query.data ?? [];

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <PageHeader
                title="Verification Activity"
                subtitle="Your company searches, report views, update requests, review flags, and bundle downloads."
                icon={<History size={22} />}
                iconColor="#5882FF"
                actions={<Button variant="outline" leftIcon={<RefreshCw size={15} />} onClick={() => query.refetch()}>Refresh</Button>}
            />

            <Card padding="none">
                {query.isLoading ? (
                    <div className="space-y-3 p-6">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-[--color-border]" />)}</div>
                ) : events.length === 0 ? (
                    <EmptyState title="No verification activity yet" description="Search for a company and open its compliance report to begin your audit trail." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="bg-[--color-surface-raised] text-xs uppercase text-[--color-text-muted]"><tr><th className="px-6 py-3">Action</th><th className="px-6 py-3">Company</th><th className="px-6 py-3">Time</th><th className="px-6 py-3">Status</th><th className="px-6 py-3" /></tr></thead>
                            <tbody className="divide-y divide-[--color-border]">
                                {events.map((event) => (
                                    <tr key={event.id} className="hover:bg-[--color-surface-raised]">
                                        <td className="px-6 py-4 font-semibold capitalize text-[--color-text-primary]">{event.action}</td>
                                        <td className="px-6 py-4 text-[--color-text-secondary]">{event.companyName ?? 'All companies'}</td>
                                        <td className="px-6 py-4 text-[--color-text-muted]">{formatDateTime(event.timestamp)}</td>
                                        <td className="px-6 py-4"><Badge variant={event.outcome === 'success' ? 'success' : 'warning'}>{event.outcome}</Badge></td>
                                        <td className="px-6 py-4 text-right">{event.companyId && <Link href={`/verify/company/${event.companyId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[--color-primary]">Open report <ExternalLink size={12} /></Link>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
