'use client';

import { useTenderMatches } from '@/lib/hooks/useTenders';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate, formatDateTime } from '@/lib/utils/formatters';
import { FileText } from 'lucide-react';

export default function AdminTendersPage() {
    const { data: tenders, isLoading, isError, refetch } = useTenderMatches();

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto">
                <PageHeader
                    title="Tender Oversight"
                    subtitle="Monitor tenders created across the platform."
                    icon={<FileText size={22} />}
                    iconColor="#7C3AED"
                />
                <Card padding="none">
                    <table className="w-full"><tbody>{[1,2,3,4].map(i => <TableRowSkeleton key={i} cols={6} />)}</tbody></table>
                </Card>
            </div>
        );
    }

    if (isError) return <ErrorState onRetry={refetch} />;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="Tender Oversight"
                subtitle="Admin view of created tenders, creators, and publication status."
                icon={<FileText size={22} />}
                iconColor="#7C3AED"
            />

            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[--color-bg] border-b border-[--color-border]">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Title</th>
                                <th className="px-4 py-3 font-semibold">Organization</th>
                                <th className="px-4 py-3 font-semibold">Created By</th>
                                <th className="px-4 py-3 font-semibold">Created At</th>
                                <th className="px-4 py-3 font-semibold">Deadline</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[--color-border]">
                            {(tenders ?? []).map((t: any) => (
                                <tr key={t.id} className="bg-[--color-surface]">
                                    <td className="px-4 py-3 text-[--color-text-primary] font-medium">{t.title}</td>
                                    <td className="px-4 py-3 text-[--color-text-primary]">{t.organization}</td>
                                    <td className="px-4 py-3 text-[--color-text-muted]">{t.createdBy ?? 'system'}</td>
                                    <td className="px-4 py-3 text-[--color-text-muted]">{t.createdAt ? formatDateTime(t.createdAt) : 'Seeded tender'}</td>
                                    <td className="px-4 py-3 text-[--color-text-muted]">{formatDate(t.deadline)}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant={t.status === 'published' ? 'success' : 'warning'} size="sm">{t.status ?? 'published'}</Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
