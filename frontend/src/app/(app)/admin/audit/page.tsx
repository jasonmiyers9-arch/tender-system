'use client';

import { useAuditLog } from '@/lib/hooks/useAdmin';
import { Table, Pagination } from '@/components/ui/Table';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTime } from '@/lib/utils/formatters';
import { Activity } from 'lucide-react';
import type { AuditEntry } from '@/lib/api/types';
import { useState } from 'react';

const PAGE_SIZE = 15;

export default function AdminAuditLogPage() {
    const [page, setPage] = useState(1);
    const { data, isLoading, isError, refetch } = useAuditLog(page, PAGE_SIZE);

    const columns = [
        {
            key: 'timestamp',
            header: 'Timestamp',
            width: '180px',
            render: (a: AuditEntry) => <span className="text-[--color-text-muted] text-xs font-mono">{formatDateTime(a.timestamp)}</span>
        },
        {
            key: 'actor',
            header: 'Actor',
            width: '200px',
            render: (a: AuditEntry) => <span className="font-medium text-[--color-text-primary] text-sm">{a.actor}</span>
        },
        {
            key: 'action',
            header: 'Action',
            render: (a: AuditEntry) => (
                <div className="flex items-center gap-2">
                    <Badge variant="default" className="font-mono">{a.entity}</Badge>
                    <span className="text-[--color-text-primary] text-sm">{a.action}</span>
                </div>
            )
        },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto flex flex-col h-full pb-10">
            <PageHeader
                title="Platform Audit Log"
                subtitle="Immutable record of all platform activity and compliance changes."
                icon={<Activity size={22} />}
                iconColor="#6366F1"
            />

            <Card padding="none" className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-auto">
                    {isLoading ? (
                        <table className="w-full"><tbody>{[1, 2, 3, 4, 5, 6, 7].map(i => <TableRowSkeleton key={i} cols={3} />)}</tbody></table>
                    ) : isError ? (
                        <ErrorState onRetry={refetch} />
                    ) : (
                        <Table columns={columns} data={data?.entries ?? []} keyExtractor={a => a.id} />
                    )}
                </div>
                <div className="border-t border-[--color-border] bg-[--color-surface] rounded-b-2xl">
                    <Pagination
                        page={page}
                        pageSize={PAGE_SIZE}
                        total={data?.total ?? 0}
                        onPageChange={setPage}
                    />
                </div>
            </Card>
        </div>
    );
}
