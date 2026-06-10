'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { useProviderTenders, useDeleteTender } from '@/lib/hooks/useTenders';
import { formatDate, formatDateTime } from '@/lib/utils/formatters';
import type { ProviderTender } from '@/lib/api/tenders';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

function statusVariant(status: string) {
    if (status === 'published') return 'success';
    if (status === 'pending') return 'warning';
    if (status === 'rejected') return 'danger';
    return 'default';
}

export default function MyTendersPage() {
    const router = useRouter();
    const { data: items, isLoading, isError, isFetching, refetch } = useProviderTenders();
    const deleteTender = useDeleteTender();
    const [deleting, setDeleting] = useState<string | null>(null);

    const handleDelete = async (t: ProviderTender) => {
        if (!confirm(`Delete "${t.title}"? This cannot be undone.`)) return;
        setDeleting(t.id);
        try {
            await deleteTender.mutateAsync(t.id);
        } finally {
            setDeleting(null);
        }
    };

    if (isLoading || (isError && isFetching)) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto">
                <PageHeader
                    title="Evaluator Tenders"
                    subtitle="Tenders you have created and their approval status."
                    icon={<FileText size={22} />}
                    iconColor="#7C3AED"
                />
                <Card padding="none">
                    <table className="w-full"><tbody>{[1,2,3].map(i => <TableRowSkeleton key={i} cols={5} />)}</tbody></table>
                </Card>
            </div>
        );
    }

    if (isError) return <ErrorState onRetry={refetch} />;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="Evaluator Tenders"
                subtitle="Tenders you have created and their approval status."
                icon={<FileText size={22} />}
                iconColor="#7C3AED"
                actions={
                    <Link href="/provider/tenders/new">
                        <Button><Plus size={16} className="mr-1.5" />New Tender</Button>
                    </Link>
                }
            />

            {(!items || items.length === 0) ? (
                <Card>
                    <EmptyState
                        title="No tenders yet"
                        description="Create your first tender to get started."
                        action={{ label: 'Upload Tender', onClick: () => router.push('/provider/tenders/new') }}
                    />
                </Card>
            ) : (
                <Card padding="none">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-[--color-bg] border-b border-[--color-border]">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Title</th>
                                    <th className="px-4 py-3 font-semibold">Organization</th>
                                    <th className="px-4 py-3 font-semibold">Deadline</th>
                                    <th className="px-4 py-3 font-semibold">Created</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[--color-border]">
                                {items.map((t) => (
                                    <tr key={t.id} className="bg-[--color-surface]">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-[--color-text-primary]">{t.title}</p>
                                            {t.rejectionReason && (
                                                <p className="text-xs text-[--color-danger] mt-0.5">Reason: {t.rejectionReason}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-[--color-text-primary]">{t.organization}</td>
                                        <td className="px-4 py-3 text-[--color-text-muted]">{formatDate(t.deadline)}</td>
                                        <td className="px-4 py-3 text-[--color-text-muted]">{t.createdAt ? formatDateTime(t.createdAt) : '-'}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant={statusVariant(t.status ?? 'draft')} size="sm">{t.status ?? 'draft'}</Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => router.push(`/provider/tenders/${t.id}/edit`)}
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    loading={deleting === t.id}
                                                    onClick={() => handleDelete(t)}
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
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
