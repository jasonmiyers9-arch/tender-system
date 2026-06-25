'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { useMyApplications } from '@/lib/hooks/useApplications';
import { formatDate, formatDateTime } from '@/lib/utils/formatters';
import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

function statusVariant(status: string) {
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'danger';
    return 'warning';
}

export default function MyApplicationsPage() {
    const router = useRouter();
    const { data: apps, isLoading, isError, refetch } = useMyApplications();

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto">
                <PageHeader
                    title="My Applications"
                    subtitle="Track the status of your tender applications."
                    icon={<ClipboardList size={22} />}
                    iconColor="#8B5CF6"
                />
                <Card padding="none">
                    <table className="w-full min-w-[720px]"><tbody>{[1,2,3].map(i => <TableRowSkeleton key={i} cols={5} />)}</tbody></table>
                </Card>
            </div>
        );
    }

    if (isError) return <ErrorState onRetry={refetch} />;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader
                title="My Applications"
                subtitle="Track the status of your tender applications."
                icon={<ClipboardList size={22} />}
                iconColor="#8B5CF6"
            />

            {!apps?.length ? (
                <Card>
                    <EmptyState
                        icon={<ClipboardList size={28} />}
                        title="No applications yet"
                        description="Browse available tenders and submit your first application."
                        action={{ label: 'Browse Tenders', onClick: () => router.push('/tenders') }}
                    />
                </Card>
            ) : (
                <Card padding="none">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="bg-[--color-bg] border-b border-[--color-border]">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Tender</th>
                                    <th className="px-4 py-3 font-semibold">Organization</th>
                                    <th className="px-4 py-3 font-semibold">Deadline</th>
                                    <th className="px-4 py-3 font-semibold">Applied</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[--color-border]">
                                {apps.map((a) => (
                                    <tr key={a.id} className="bg-[--color-surface]">
                                        <td className="px-4 py-3">
                                            <Link href={`/tenders/${a.tenderId}/apply`} className="font-medium text-[--color-primary] hover:underline">
                                                {a.tenderTitle}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-[--color-text-primary]">{a.tenderOrganization}</td>
                                        <td className="px-4 py-3 text-[--color-text-muted]">{formatDate(a.tenderDeadline)}</td>
                                        <td className="px-4 py-3 text-[--color-text-muted]">{formatDateTime(a.appliedAt)}</td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-0.5">
                                                <Badge variant={statusVariant(a.status)} size="sm">{a.status}</Badge>
                                                {a.rejectionReason && (
                                                    <p className="text-xs text-[--color-danger]">{a.rejectionReason}</p>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
