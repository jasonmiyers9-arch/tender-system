'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/lib/hooks/useNotifications';
import { Bell, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

function formatWhen(ts: string | null): string {
    if (!ts) return 'Just now';
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? 'Just now' : d.toLocaleString();
}

export default function NotificationsPage() {
    const query = useNotifications(50);
    const markOne = useMarkNotificationRead();
    const markAll = useMarkAllNotificationsRead();

    const items = query.data ?? [];

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <PageHeader
                title="Notifications"
                subtitle="Document expiry reminders and system alerts."
                icon={<Bell size={22} />}
                iconColor="#F59E0B"
                actions={<Button variant="ghost" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>Mark all as read</Button>}
            />

            <Card padding="none">
                {!items.length ? (
                    <EmptyState icon={<Bell size={24} />} title="All caught up" description="You have no notifications right now." />
                ) : (
                    <div className="divide-y divide-[--color-border]">
                        {items.map((n) => (
                            <button
                                key={n.id}
                                className="w-full text-left p-4 sm:p-5 flex items-start gap-4 hover:bg-[--color-bg] transition-colors"
                                onClick={() => !n.isRead && markOne.mutate(n.id)}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border ${n.isRead ? 'bg-[--color-bg] border-[--color-border]' : 'bg-[#FFFBEB] border-[#FCD34D]'}`}>
                                    <AlertTriangle size={18} className={n.isRead ? 'text-[--color-text-muted]' : 'text-[--color-warning]'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-[--color-text-primary]">{n.title}</p>
                                    <p className="text-sm text-[--color-text-muted] mt-1">{n.message}</p>
                                    <p className="text-xs font-mono text-[--color-text-muted] mt-2">{formatWhen(n.createdAt)}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
