'use client';

import { useScore } from '@/lib/hooks/useScore';
import { useVaultDocuments } from '@/lib/hooks/useVault';
import { useTenderMatches } from '@/lib/hooks/useTenders';
import { useAuditLog } from '@/lib/hooks/useAdmin';
import { useNotifications, useMarkAllNotificationsRead } from '@/lib/hooks/useNotifications';
import { ScoreCard, StatCard } from '@/components/cards/Cards';
import { StatusBadge } from '@/components/badges/Badges';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate, formatDateTime } from '@/lib/utils/formatters';
import { AlertTriangle, FileSearch, Clock, TrendingUp, Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';

export default function DashboardPage() {
    const scoreQuery = useScore();
    const role = useAppStore((s) => s.currentUser?.role ?? 'user');
    const docsQuery = useVaultDocuments();
    const tendersQuery = useTenderMatches();
    const auditQuery = useAuditLog(1, 5);
    const notifQuery = useNotifications(5);
    const markAllRead = useMarkAllNotificationsRead();

    const expiringDocs = docsQuery.data?.filter(
        (d) => d.status === 'expired' || d.status === 'uploaded'
    ) ?? [];
    const docsUploadedCount = docsQuery.data?.length ?? 0;
    const showOnboardingChecklist = role === 'user' && docsUploadedCount < 5;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-[--color-text-primary]">Dashboard</h1>
                <p className="text-sm text-[--color-text-muted] mt-0.5">
                    Your compliance overview at a glance
                </p>
            </div>

            {showOnboardingChecklist && (
                <div className="rounded-xl border border-[#93C5FD] bg-[#EFF6FF] p-4">
                    <p className="text-sm font-semibold text-[#1E40AF]">Onboarding checklist</p>
                    <p className="text-xs text-[#1D4ED8] mt-1">
                        Upload at least 5 documents to complete onboarding visibility. Priority first 3: B-BBEE certificate, SARS TCS Pin, CIPC registration certificate.
                    </p>
                </div>
            )}

            {/* Top row: Score + Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Score card */}
                <div className="lg:col-span-1">
                    {scoreQuery.isLoading ? (
                        <CardSkeleton />
                    ) : scoreQuery.isError ? (
                        <ErrorState
                            onRetry={() => scoreQuery.refetch()}
                            message="Unable to load compliance score."
                        />
                    ) : scoreQuery.data ? (
                        <ScoreCard score={scoreQuery.data} />
                    ) : null}
                </div>

                {/* Stat cards */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                        title="Total Documents"
                        value={docsQuery.data?.length ?? '—'}
                        subtitle="in compliance vault"
                        icon={<FileSearch size={18} />}
                    />
                    <StatCard
                        title="Expiring / Expired"
                        value={expiringDocs.length}
                        subtitle="need attention"
                        icon={<Clock size={18} />}
                        variant={expiringDocs.length > 0 ? 'warning' : 'default'}
                    />
                    <StatCard
                        title="Tender Matches"
                        value={tendersQuery.data?.length ?? '—'}
                        subtitle="available opportunities"
                        icon={<TrendingUp size={18} />}
                        variant="success"
                    />
                </div>
            </div>

            {/* Alerts */}
            {(docsQuery.data?.filter((d) => d.status === 'expired').length ?? 0) > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-[#FCD34D] bg-[#FFFBEB]">
                    <AlertTriangle size={18} className="text-[--color-warning] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-[--color-text-primary]">
                            {docsQuery.data?.filter((d) => d.status === 'expired').length} document(s) expired
                        </p>
                        <p className="text-xs text-[--color-text-muted] mt-0.5">
                            Expired documents reduce your Tender Readiness Score. Renew them to stay compliant.
                        </p>
                    </div>
                    <Link href="/vault">
                        <Button size="sm" variant="ghost">View Vault</Button>
                    </Link>
                </div>
            )}

            {/* Bottom row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expiring docs */}
                <Card
                    header={
                        <>
                            <h3 className="text-sm font-semibold text-[--color-text-primary]">
                                Documents Requiring Action
                            </h3>
                            <Link href="/vault" className="text-xs text-[--color-primary] hover:underline">
                                View all
                            </Link>
                        </>
                    }
                    padding="none"
                >
                    {docsQuery.isLoading ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : expiringDocs.length === 0 ? (
                        <div className="py-10 text-center text-sm text-[--color-text-muted]">
                            ✅ All documents are up to date
                        </div>
                    ) : (
                        <ul className="divide-y divide-[--color-border]">
                            {expiringDocs.slice(0, 5).map((doc) => (
                                <li key={doc.id} className="flex items-center justify-between px-6 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-[--color-text-primary]">{doc.name}</p>
                                        <p className="text-xs text-[--color-text-muted]">
                                            {doc.expiryDate ? `Expires ${formatDate(doc.expiryDate)}` : 'No expiry set'}
                                        </p>
                                    </div>
                                    <StatusBadge status={doc.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                {/* Tender previews */}
                <Card
                    header={
                        <>
                            <h3 className="text-sm font-semibold text-[--color-text-primary]">
                                Top Tender Matches
                            </h3>
                            <Link href="/tenders" className="text-xs text-[--color-primary] hover:underline">
                                View all
                            </Link>
                        </>
                    }
                    padding="none"
                >
                    {tendersQuery.isLoading ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : tendersQuery.error ? (
                        <ErrorState message="Could not load tender matches." />
                    ) : !tendersQuery.data?.length ? (
                        <div className="py-10 text-center text-sm text-[--color-text-muted]">
                            No tender matches yet
                        </div>
                    ) : (
                        <ul className="divide-y divide-[--color-border]">
                            {tendersQuery.data.slice(0, 4).map((t) => (
                                <li key={t.id}>
                                    <Link
                                        href={`/tenders/${t.id}`}
                                        className="flex items-center justify-between px-6 py-3 hover:bg-[--color-bg] transition-colors"
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="text-sm font-medium text-[--color-text-primary] truncate">
                                                {t.title}
                                            </p>
                                            <p className="text-xs text-[--color-text-muted]">
                                                Deadline: {formatDate(t.deadline)}
                                            </p>
                                        </div>
                                        <Badge
                                            variant={
                                                t.matchScore >= 85 ? 'success' : t.matchScore >= 65 ? 'warning' : 'danger'
                                            }
                                            size="sm"
                                        >
                                            {t.matchScore}%
                                        </Badge>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            {/* Recent audit activity (admin only) */}
            {role === 'admin' && (
                <Card
                    header={
                        <>
                            <h3 className="text-sm font-semibold text-[--color-text-primary]">Recent Activity</h3>
                            <Link href="/admin/audit" className="text-xs text-[--color-primary] hover:underline">
                                Full audit log
                            </Link>
                        </>
                    }
                    padding="none"
                >
                    {auditQuery.isLoading ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                        </div>
                    ) : (
                        <ul className="divide-y divide-[--color-border]">
                            {auditQuery.data?.entries.map((entry) => (
                                <li key={entry.id} className="flex items-start gap-4 px-6 py-3">
                                    <div className="w-7 h-7 rounded-full bg-[--color-primary] flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-[--color-text-primary] text-[10px] font-bold">
                                            {entry.actor.charAt(0)}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-[--color-text-primary]">
                                            <span className="font-medium">{entry.actor}</span> — {entry.action}
                                        </p>
                                        <p className="text-xs text-[--color-text-muted]">{formatDateTime(entry.timestamp)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            )}

            {/* Notifications panel */}
            <Card
                header={
                    <>
                        <div className="flex items-center gap-2">
                            <Bell size={15} className="text-[--color-primary]" />
                            <h3 className="text-sm font-semibold text-[--color-text-primary]">Notifications</h3>
                            {(notifQuery.data?.filter((n) => !n.isRead).length ?? 0) > 0 && (
                                <Badge variant="danger" size="sm">
                                    {notifQuery.data!.filter((n) => !n.isRead).length} new
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<CheckCheck size={13} />}
                                onClick={() => markAllRead.mutate()}
                                disabled={markAllRead.isPending}
                            >
                                Mark all read
                            </Button>
                            <Link href="/notifications" className="text-xs text-[--color-primary] hover:underline">
                                View all
                            </Link>
                        </div>
                    </>
                }
                padding="none"
            >
                {notifQuery.isLoading ? (
                    <div className="p-4 space-y-3">
                        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : !notifQuery.data?.length ? (
                    <div className="py-8 text-center text-sm text-[--color-text-muted]">
                        🔔 You&apos;re all caught up — no notifications
                    </div>
                ) : (
                    <ul className="divide-y divide-[--color-border]">
                        {notifQuery.data.slice(0, 5).map((n) => (
                            <li
                                key={n.id}
                                className={`flex items-start gap-4 px-6 py-3 transition-colors ${
                                    n.isRead ? '' : 'bg-[--color-bg]'
                                }`}
                            >
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${n.isRead ? 'bg-transparent' : 'bg-[--color-primary]'}`} />
                                <div className="flex-1">
                                    <p className={`text-sm ${n.isRead ? 'text-[--color-text-muted]' : 'font-semibold text-[--color-text-primary]'}`}>
                                        {n.title}
                                    </p>
                                    <p className="text-xs text-[--color-text-muted] mt-0.5 line-clamp-1">{n.message}</p>
                                </div>
                                <p className="text-[10px] text-[--color-text-muted] flex-shrink-0 mt-0.5">
                                    {formatDate(n.triggerDate)}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}

