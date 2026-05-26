'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import {
    Bell, CheckCircle2, FileText, UserPlus, Clock,
    Building2, ShieldCheck, AlertTriangle, FileCheck, ArrowRight,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
    useAdminDashboard,
    useRenewalsPipeline,
    usePendingAdminDocuments,
    useAdminAccounts,
    useAuditLog,
    useVerifyDocument,
    useRejectDocument,
    useApproveAccount,
    useRejectAccount,
} from '@/lib/hooks/useAdmin';
import { PageHeader } from '@/components/ui/PageHeader';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { fadeUp, T } from '@/lib/motion';
import { formatDateTime } from '@/lib/utils/formatters';
import type { ReactNode } from 'react';

function greetingWord() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

function relativeFromNow(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffMin = Math.round((Date.now() - then) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 30) return `${diffD}d ago`;
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

type PrimaryTone = 'success' | 'primary';

interface QueueRowAction {
    label: string;
    onClick?: () => void;
    href?: string;
    tone?: PrimaryTone | 'danger' | 'muted';
    disabled?: boolean;
}

interface QueueRowProps {
    title: string;
    subtitle: string;
    primary: QueueRowAction;
    secondaries?: QueueRowAction[];
    urgent?: boolean;
}

function QueueRow({ title, subtitle, primary, secondaries = [], urgent = false }: QueueRowProps) {
    const primaryClasses =
        primary.tone === 'success'
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
            : 'bg-[--color-primary] hover:bg-[--color-primary-dark] text-white shadow-sm';
    const primaryBase = `inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${primaryClasses}`;

    return (
        <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-[--color-surface] transition-colors ${urgent ? 'border-amber-500/40' : 'border-[--color-border] hover:border-[--color-border-strong]'}`}
        >
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[--color-text-primary] truncate">{title}</p>
                <p className="text-xs text-[--color-text-muted] mt-0.5 truncate">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {secondaries.map((s) => {
                    const cls =
                        s.tone === 'danger'
                            ? 'text-[--color-danger] hover:bg-red-500/10'
                            : 'text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text-primary]';
                    if (s.href) {
                        return (
                            <Link key={s.label} href={s.href} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${cls}`}>
                                {s.label}
                            </Link>
                        );
                    }
                    return (
                        <button
                            key={s.label}
                            type="button"
                            onClick={s.onClick}
                            disabled={s.disabled}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${cls}`}
                        >
                            {s.label}
                        </button>
                    );
                })}
                {primary.href ? (
                    <Link href={primary.href} className={primaryBase}>{primary.label}</Link>
                ) : (
                    <button
                        type="button"
                        onClick={primary.onClick}
                        disabled={primary.disabled}
                        className={primaryBase}
                    >
                        {primary.label}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

interface QueueSectionProps {
    label: string;
    count: number;
    icon: ReactNode;
    emptyMessage: string;
    viewAllHref: string;
    children: ReactNode;
}

function QueueSection({ label, count, icon, emptyMessage, viewAllHref, children }: QueueSectionProps) {
    const isEmpty = count === 0;
    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--color-text-muted]">
                    <span className="text-[--color-primary]">{icon}</span>
                    {label}
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-[--color-bg] text-[--color-text-muted] normal-case tracking-normal">
                        {isEmpty ? 'all clear' : `${count} waiting`}
                    </span>
                </h2>
                {!isEmpty && (
                    <Link href={viewAllHref} className="flex items-center gap-1 text-xs font-semibold text-[--color-primary] hover:underline">
                        Open queue <ArrowRight size={12} />
                    </Link>
                )}
            </div>

            {isEmpty ? (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-[--color-border] bg-[--color-surface]">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-600">
                        <CheckCircle2 size={16} />
                    </div>
                    <p className="text-sm text-[--color-text-muted]">{emptyMessage}</p>
                </div>
            ) : (
                <div className="space-y-2">{children}</div>
            )}
        </section>
    );
}

interface ForecastPillProps {
    label: string;
    value: number;
    icon: ReactNode;
    tone?: 'success' | 'warning' | 'danger';
}

function ForecastPill({ label, value, icon, tone }: ForecastPillProps) {
    const toneClass =
        tone === 'success' ? 'text-emerald-600' :
        tone === 'warning' ? 'text-amber-600' :
        tone === 'danger' ? 'text-red-600' :
        'text-[--color-text-primary]';
    return (
        <div className="flex items-center gap-2">
            <span className="text-[--color-text-muted]">{icon}</span>
            <span className={`text-sm font-bold tabular-nums ${toneClass}`}>{value}</span>
            <span className="text-xs text-[--color-text-muted]">{label}</span>
        </div>
    );
}

export default function AdminTodayPage() {
    const currentUser = useAppStore((s) => s.currentUser);
    const statsQuery = useAdminDashboard();
    const pipelineQuery = useRenewalsPipeline();
    const docsQuery = usePendingAdminDocuments();
    const accountsQuery = useAdminAccounts('pending');
    const auditQuery = useAuditLog(1, 5);

    const verifyDoc = useVerifyDocument();
    const rejectDoc = useRejectDocument();
    const approveAccount = useApproveAccount();
    const rejectAccount = useRejectAccount();

    const queries = [statsQuery, pipelineQuery, docsQuery, accountsQuery];
    const isLoading = queries.some((q) => q.isLoading);
    const errMsg = queries.map((q) => (q.error as Error | null)?.message ?? '').join(' ');
    const isForbidden = errMsg.includes('403');
    const isAnyError = queries.some((q) => q.isError);
    const isAnyFetching = queries.some((q) => q.isFetching);

    if (isForbidden) {
        return (
            <ErrorState
                title="Access denied"
                message="Your current account does not have admin access for this workspace."
            />
        );
    }

    if (isLoading || (isAnyError && isAnyFetching)) {
        return (
            <div className="space-y-6 max-w-[1200px] mx-auto">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
        );
    }

    if (isAnyError) {
        return <ErrorState onRetry={() => queries.forEach((q) => q.refetch())} />;
    }

    const stats = statsQuery.data!;
    const pipeline = pipelineQuery.data ?? [];
    const pendingDocs = docsQuery.data?.items ?? [];
    const pendingAccounts = (accountsQuery.data?.items ?? []).filter((a) => a.verificationStatus === 'pending');
    const auditEntries = auditQuery.data?.entries ?? [];

    const dueThisWeek = pipeline.filter((r) => r.bucket === 'expired' || r.bucket === 'due-7');
    const dueIn30 = pipeline.filter((r) => r.bucket === 'expired' || r.bucket === 'due-7' || r.bucket === 'due-30').length;
    const totalToDo = pendingDocs.length + pendingAccounts.length + dueThisWeek.length;
    const hasOverdue =
        dueThisWeek.some((r) => r.bucket === 'expired') ||
        pendingAccounts.some((a) => a.slaBreached);

    const firstName =
        currentUser?.name?.split(' ')[0] ??
        currentUser?.email?.split('@')[0] ??
        'there';

    const heroLine =
        totalToDo === 0
            ? `Inbox empty. ${stats.totalCompanies} clients on the books.`
            : `${totalToDo} ${totalToDo === 1 ? 'item needs' : 'items need'} you · ${dueIn30} ${dueIn30 === 1 ? 'renewal' : 'renewals'} in the next 30 days`;

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto">
            <div className="relative">
                <PageHeader
                    title={`${greetingWord()}, ${firstName}`}
                    subtitle={heroLine}
                    icon={hasOverdue ? <Bell size={22} /> : <CheckCircle2 size={22} />}
                    iconColor={hasOverdue ? '#F59E0B' : '#10B981'}
                />
                {hasOverdue && (
                    <motion.span
                        aria-hidden
                        className="absolute top-5 left-5 w-2.5 h-2.5 rounded-full bg-amber-400"
                        animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.1, 0.9] }}
                        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                    />
                )}
            </div>

            <QueueSection
                label="Verify documents"
                count={pendingDocs.length}
                icon={<FileText size={14} />}
                emptyMessage="Nothing pending. Inbox clear."
                viewAllHref="/admin/documents"
            >
                {pendingDocs.slice(0, 3).map((doc) => (
                    <QueueRow
                        key={doc.id}
                        title={doc.name}
                        subtitle={`${doc.companyName} · ${doc.category} · uploaded ${relativeFromNow(doc.lastUpdated)}`}
                        primary={{
                            label: verifyDoc.isPending && verifyDoc.variables === doc.id ? 'Verifying…' : 'Verify',
                            tone: 'success',
                            onClick: () => verifyDoc.mutate(doc.id),
                            disabled: verifyDoc.isPending,
                        }}
                        secondaries={[
                            { label: 'Open', href: `/admin/companies/${doc.companyId}` },
                            {
                                label: 'Reject',
                                tone: 'danger',
                                onClick: () => {
                                    if (window.confirm(`Reject "${doc.name}"?`)) {
                                        rejectDoc.mutate({ docId: doc.id, reason: 'Rejected by admin' });
                                    }
                                },
                                disabled: rejectDoc.isPending,
                            },
                        ]}
                    />
                ))}
            </QueueSection>

            <QueueSection
                label="Approve accounts"
                count={pendingAccounts.length}
                icon={<UserPlus size={14} />}
                emptyMessage="Nothing pending. You're caught up."
                viewAllHref="/admin/accounts"
            >
                {pendingAccounts.slice(0, 3).map((acc) => (
                    <QueueRow
                        key={acc.id}
                        title={acc.name || acc.email}
                        subtitle={`${acc.email}${acc.companyName ? ` · ${acc.companyName}` : ''}${acc.slaBreached ? ' · SLA breached' : ` · waiting ${Math.round(acc.pendingHours)}h`}`}
                        primary={{
                            label: approveAccount.isPending && approveAccount.variables === acc.id ? 'Approving…' : 'Approve',
                            tone: 'success',
                            onClick: () => approveAccount.mutate(acc.id),
                            disabled: approveAccount.isPending,
                        }}
                        secondaries={[
                            {
                                label: 'Reject',
                                tone: 'danger',
                                onClick: () => {
                                    if (window.confirm(`Reject account for ${acc.name || acc.email}?`)) {
                                        rejectAccount.mutate({ userId: acc.id });
                                    }
                                },
                                disabled: rejectAccount.isPending,
                            },
                        ]}
                        urgent={acc.slaBreached}
                    />
                ))}
            </QueueSection>

            <QueueSection
                label="Renewals this week"
                count={dueThisWeek.length}
                icon={<Clock size={14} />}
                emptyMessage={`Nothing expiring in 7 days. ${dueIn30} due in next 30.`}
                viewAllHref="/admin/companies"
            >
                {dueThisWeek.slice(0, 3).map((item) => (
                    <QueueRow
                        key={item.id}
                        title={item.companyName}
                        subtitle={`${item.documentName} · ${item.daysUntilExpiry < 0 ? `expired ${Math.abs(item.daysUntilExpiry)}d ago` : `expires in ${item.daysUntilExpiry}d`}`}
                        primary={{
                            label: 'Open client',
                            tone: 'primary',
                            href: `/admin/companies/${item.companyId}`,
                        }}
                        urgent={item.daysUntilExpiry < 0}
                    />
                ))}
            </QueueSection>

            <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                transition={{ ...T.smooth, delay: 0.1 }}
                className="rounded-2xl border border-[--color-border] bg-[--color-surface] px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3"
            >
                <ForecastPill label="Clients" value={stats.totalCompanies} icon={<Building2 size={14} />} />
                <ForecastPill label="Tender ready" value={stats.tenderReady} icon={<ShieldCheck size={14} />} tone="success" />
                <ForecastPill label="Partially ready" value={stats.partiallyReady} icon={<AlertTriangle size={14} />} tone="warning" />
                <ForecastPill label="High risk" value={stats.highRisk} icon={<AlertTriangle size={14} />} tone="danger" />
                <ForecastPill label="Managed docs" value={stats.totalDocuments} icon={<FileCheck size={14} />} />
                <ForecastPill label="Due in 30 days" value={dueIn30} icon={<Clock size={14} />} />
            </motion.div>

            <section className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-[--color-text-muted]">Recent</h2>
                    <Link href="/admin/audit" className="flex items-center gap-1 text-xs font-semibold text-[--color-primary] hover:underline">
                        Full audit log <ArrowRight size={12} />
                    </Link>
                </div>
                {auditEntries.length === 0 ? (
                    <p className="text-sm text-[--color-text-muted]">No recent activity.</p>
                ) : (
                    <ul className="space-y-2">
                        {auditEntries.slice(0, 5).map((e) => (
                            <li key={e.id} className="flex items-center gap-3 text-sm">
                                <span className="text-xs text-[--color-text-muted] tabular-nums w-36 flex-shrink-0 font-mono">
                                    {formatDateTime(e.timestamp)}
                                </span>
                                <span className="font-medium text-[--color-text-primary] truncate flex-shrink-0 max-w-[180px]">
                                    {e.actor}
                                </span>
                                <span className="text-[--color-text-muted] truncate">{e.action}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
