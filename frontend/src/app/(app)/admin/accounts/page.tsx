'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAdminAccounts, useApproveAccount, useRejectAccount, useResetPendingAccount } from '@/lib/hooks/useAdmin';
import { Users } from 'lucide-react';

export default function AdminAccountsPage() {
    const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const { data, isLoading, isError, error, refetch } = useAdminAccounts(status);
    const approve = useApproveAccount();
    const reject = useRejectAccount();
    const resetPending = useResetPendingAccount();

    const items = data?.items ?? [];

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <PageHeader
                title="Accounts / Companies"
                subtitle="Verify newly created accounts before portal access."
                icon={<Users size={22} />}
                iconColor="#3B82F6"
            />

            <div className="flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                    <Button key={s} size="sm" variant={status === s ? 'primary' : 'ghost'} onClick={() => setStatus(s)}>
                        {s}
                    </Button>
                ))}
            </div>

            <Card>
                {isLoading ? (
                    <p className="text-sm text-[--color-text-muted]">Loading accounts...</p>
                ) : isError ? (
                    <p className="text-sm text-[--color-danger]">{error instanceof Error ? error.message : 'Failed to load accounts'}</p>
                ) : items.length === 0 ? (
                    <p className="text-sm text-[--color-text-muted]">No accounts found for this filter.</p>
                ) : (
                    <ul className="space-y-3">
                        {items.map((u) => (
                            <li key={u.id} className="p-3 rounded-lg border border-[--color-border] bg-[--color-bg]">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-[--color-text-primary]">{u.name}</p>
                                        <p className="text-xs text-[--color-text-muted]">{u.email}</p>
                                        <p className="text-xs text-[--color-text-muted]">Company: {u.companyName || '—'}</p>
                                        {u.verificationStatus === 'pending' && (
                                            <p className={`text-xs mt-1 ${u.slaBreached ? 'text-[--color-danger]' : 'text-[--color-text-muted]'}`}>
                                                Pending for {u.pendingHours}h {u.slaBreached ? '(SLA breached)' : ''}
                                            </p>
                                        )}
                                    </div>
                                    <Badge variant={u.verificationStatus === 'approved' ? 'success' : u.verificationStatus === 'rejected' ? 'danger' : 'warning'} size="sm">
                                        {u.verificationStatus}
                                    </Badge>
                                </div>
                                {u.verificationStatus === 'pending' && (
                                    <div className="mt-3 flex gap-2">
                                        <Button size="sm" onClick={() => approve.mutate(u.id, { onSuccess: () => refetch() })}>Approve</Button>
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() => {
                                                const reason = window.prompt('Reject reason (optional):') || undefined;
                                                reject.mutate({ userId: u.id, reason }, { onSuccess: () => refetch() });
                                            }}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                )}
                                {u.verificationStatus !== 'pending' && (
                                    <div className="mt-3 flex gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => resetPending.mutate(u.id, { onSuccess: () => refetch() })}>
                                            Move to Pending
                                        </Button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}
