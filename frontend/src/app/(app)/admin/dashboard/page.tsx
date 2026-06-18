'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import {
    Bell, CheckCircle2, FileText, UserPlus, Clock, Shield,
    Building2, ShieldCheck, AlertTriangle, FileCheck, ArrowRight,
    Activity, CalendarDays,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useCompanies, useSwitchCompany } from '@/lib/hooks/useCompanies';
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
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { fadeUp, T, stagger } from '@/lib/motion';
import { formatDateTime } from '@/lib/utils/formatters';
import type { ReactNode } from 'react';

type Accent = 'indigo' | 'emerald' | 'amber';

const ACCENT: Record<Accent, {
    hex: string;
    bar: string;
    chip: string;
    chipText: string;
    iconWrap: string;
    iconText: string;
    button: string;
    rowEdge: string;
    glow: string;
}> = {
    indigo: {
        hex: '#4F46E5',
        bar: 'bg-gradient-to-b from-indigo-400 to-indigo-600',
        chip: 'bg-indigo-500/10 border-indigo-500/30',
        chipText: 'text-indigo-600 dark:text-indigo-300',
        iconWrap: 'bg-indigo-500/10',
        iconText: 'text-indigo-600 dark:text-indigo-300',
        button: 'bg-indigo-600 hover:bg-indigo-700',
        rowEdge: 'before:bg-indigo-500',
        glow: 'rgba(79,70,229,0.18)',
    },
    emerald: {
        hex: '#10B981',
        bar: 'bg-gradient-to-b from-emerald-400 to-emerald-600',
        chip: 'bg-emerald-500/10 border-emerald-500/30',
        chipText: 'text-emerald-600 dark:text-emerald-300',
        iconWrap: 'bg-emerald-500/10',
        iconText: 'text-emerald-600 dark:text-emerald-300',
        button: 'bg-emerald-600 hover:bg-emerald-700',
        rowEdge: 'before:bg-emerald-500',
        glow: 'rgba(16,185,129,0.18)',
    },
    amber: {
        hex: '#F59E0B',
        bar: 'bg-gradient-to-b from-amber-400 to-amber-600',
        chip: 'bg-amber-500/10 border-amber-500/30',
        chipText: 'text-amber-600 dark:text-amber-300',
        iconWrap: 'bg-amber-500/10',
        iconText: 'text-amber-600 dark:text-amber-300',
        button: 'bg-amber-500 hover:bg-amber-600',
        rowEdge: 'before:bg-amber-500',
        glow: 'rgba(245,158,11,0.18)',
    },
};

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

function todayCaption(): string {
    return new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' });
}

interface QueueRowAction {
    label: string;
    onClick?: () => void;
    href?: string;
    tone?: 'primary' | 'danger' | 'muted';
    disabled?: boolean;
}

interface QueueRowProps {
    title: string;
    subtitle: string;
    accent: Accent;
    icon: ReactNode;
    primary: QueueRowAction;
    secondaries?: QueueRowAction[];
    urgent?: boolean;
}

function QueueRow({ title, subtitle, accent, icon, primary, secondaries = [], urgent = false }: QueueRowProps) {
    const a = ACCENT[accent];
    const primaryBase = `inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:-translate-y-0.5 ${a.button}`;

    return (
        <motion.div
            variants={fadeUp}
            whileHover={{ y: -2 }}
            transition={T.snappy}
            className={`relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-5 pr-4 py-3.5 rounded-xl bg-[--color-surface] before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 ${a.rowEdge} ${urgent ? 'ring-2 ring-amber-400/40' : 'border border-[--color-border]'} card-shadow`}
            style={{
                backgroundImage: `radial-gradient(120% 60% at -10% 50%, ${a.glow}, transparent 60%)`,
            }}
        >
            <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${a.iconWrap} ${a.iconText}`}>
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[--color-text-primary] truncate">{title}</p>
                    <p className="text-xs text-[--color-text-muted] mt-0.5 truncate">{subtitle}</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
                {secondaries.map((s) => {
                    const cls =
                        s.tone === 'danger'
                            ? 'text-[--color-danger] hover:bg-red-500/10'
                            : 'text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text-primary]';
                    if (s.href) {
                        return (
                            <Link key={s.label} href={s.href} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${cls}`}>
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
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${cls}`}
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
    accent: Accent;
    icon: ReactNode;
    emptyMessage: string;
    viewAllHref: string;
    children: ReactNode;
}

function QueueSection({ label, count, accent, icon, emptyMessage, viewAllHref, children }: QueueSectionProps) {
    const a = ACCENT[accent];
    const isEmpty = count === 0;
    return (
        <section className="space-y-2.5">
            <div className="flex items-center gap-3">
                <div className={`w-1 h-6 rounded-full ${a.bar}`} />
                <h2 className="flex items-center gap-2 text-sm font-bold text-[--color-text-primary] tracking-tight">
                    <span className={a.iconText}>{icon}</span>
                    {label}
                </h2>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase ${isEmpty ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : `${a.chip} ${a.chipText}`}`}>
                    {isEmpty ? 'All clear' : `${count} waiting`}
                </span>
                <div className="flex-1" />
                {!isEmpty && (
                    <Link href={viewAllHref} className={`flex items-center gap-1 text-xs font-semibold ${a.iconText} hover:underline`}>
                        Open queue <ArrowRight size={12} />
                    </Link>
                )}
            </div>

            {isEmpty ? (
                <p className="pl-4 text-xs text-[--color-text-muted] italic">
                    <CheckCircle2 size={12} className="inline-block mr-1.5 -mt-0.5 text-emerald-500" />
                    {emptyMessage}
                </p>
            ) : (
                <motion.div
                    variants={stagger(0.05)}
                    initial="hidden"
                    animate="show"
                    className="space-y-2"
                >
                    {children}
                </motion.div>
            )}
        </section>
    );
}

interface ForecastItemProps {
    label: string;
    value: number;
    icon: ReactNode;
    tone?: 'success' | 'warning' | 'danger';
}

function ForecastItem({ label, value, icon, tone }: ForecastItemProps) {
    const toneClass =
        tone === 'success' ? 'text-emerald-600' :
        tone === 'warning' ? 'text-amber-600' :
        tone === 'danger' ? 'text-red-600' :
        'text-[--color-text-primary]';
    const ringClass =
        tone === 'success' ? 'ring-emerald-500/20 bg-emerald-500/5' :
        tone === 'warning' ? 'ring-amber-500/20 bg-amber-500/5' :
        tone === 'danger' ? 'ring-red-500/20 bg-red-500/5' :
        'ring-[--color-border] bg-[--color-bg]';
    return (
        <div className={`flex items-center gap-3 px-3.5 py-3 rounded-xl ring-1 ${ringClass}`}>
            <span className="text-[--color-text-muted]">{icon}</span>
            <div className="min-w-0">
                <p className={`text-lg font-extrabold leading-none tabular-nums ${toneClass}`}>{value}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[--color-text-muted] mt-1">{label}</p>
            </div>
        </div>
    );
}

export default function AdminTodayPage() {
    const currentUser = useAppStore((s) => s.currentUser);
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    const companiesQuery = useCompanies();
    const switchCompany = useSwitchCompany();
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
            <div className="space-y-6 max-w-[1280px] mx-auto">
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
    const managedCompanies = companiesQuery.data ?? [];

    const heroLine =
        totalToDo === 0
            ? `Inbox empty. ${stats.totalCompanies} clients on the books.`
            : `${totalToDo} ${totalToDo === 1 ? 'item needs' : 'items need'} you · ${dueIn30} ${dueIn30 === 1 ? 'renewal' : 'renewals'} in next 30 days`;

    return (
        <div className="relative">
            {/* Page ambient backdrop — soft indigo radial top-left + faint dot grid */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 -z-10"
                style={{
                    backgroundImage:
                        'radial-gradient(800px 500px at 0% -10%, rgba(79,70,229,0.10), transparent 60%), radial-gradient(700px 400px at 100% 0%, rgba(124,58,237,0.08), transparent 55%)',
                }}
            />

            <div className="space-y-6 max-w-[1280px] mx-auto">
                {managedCompanies.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {managedCompanies.map((company) => {
                            const active = company.id === activeCompanyId;
                            const alerts = company.status === 'verified' ? 0 : 1;
                            return (
                                <button
                                    key={company.id}
                                    type="button"
                                    onClick={() => switchCompany.mutate(company.id)}
                                    className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                                        active
                                            ? 'border-teal-500 bg-teal-500/10 text-teal-700'
                                            : 'border-[--color-border] bg-[--color-surface] text-[--color-text-muted] hover:text-[--color-text-primary]'
                                    }`}
                                >
                                    {company.name}
                                    <span className={`ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-teal-500 text-white' : 'bg-[--color-bg] text-[--color-text-muted]'}`}>
                                        {alerts}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ─── HERO ─────────────────────────────────────────────────── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="relative overflow-hidden rounded-3xl border border-white/5 px-6 py-7 sm:px-9 sm:py-9"
                    style={{
                        background:
                            'linear-gradient(135deg, #0F0A2E 0%, #1E1B4B 35%, #312E81 65%, #1E3A5C 100%)',
                    }}
                >
                    {/* Animated gradient blobs */}
                    <motion.div
                        aria-hidden
                        className="absolute -top-24 -right-16 w-[420px] h-[420px] rounded-full blur-3xl opacity-50"
                        style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }}
                        animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
                        transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }}
                    />
                    <motion.div
                        aria-hidden
                        className="absolute -bottom-20 -left-10 w-[360px] h-[360px] rounded-full blur-3xl opacity-30"
                        style={{ background: 'radial-gradient(circle, #4F46E5 0%, transparent 70%)' }}
                        animate={{ x: [0, -14, 0], y: [0, 10, 0] }}
                        transition={{ repeat: Infinity, duration: 16, ease: 'easeInOut', delay: 1 }}
                    />
                    {/* Sheen sweep */}
                    <motion.div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background:
                                'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.10) 50%, transparent 70%)',
                            backgroundSize: '200% 100%',
                        }}
                        animate={{ backgroundPosition: ['-100% 0%', '200% 0%'] }}
                        transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                    />
                    {/* Dot grid overlay */}
                    <div
                        aria-hidden
                        className="absolute inset-0 opacity-[0.07]"
                        style={{
                            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                            backgroundSize: '24px 24px',
                        }}
                    />
                    {/* Shield watermark */}
                    <motion.div
                        aria-hidden
                        className="absolute -right-6 -bottom-8 opacity-[0.08]"
                        animate={{ rotate: [0, 6, 0] }}
                        transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }}
                    >
                        <Shield size={180} color="white" />
                    </motion.div>

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="flex items-start gap-5">
                            {/* Status icon with glow */}
                            <div className="relative">
                                <motion.div
                                    initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
                                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                    transition={{ ...T.softSpring, delay: 0.05 }}
                                    className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-white"
                                    style={{
                                        background: hasOverdue
                                            ? 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)'
                                            : 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                                        boxShadow: hasOverdue
                                            ? '0 8px 28px rgba(245,158,11,0.45)'
                                            : '0 8px 28px rgba(16,185,129,0.45)',
                                    }}
                                >
                                    {hasOverdue ? <Bell size={24} /> : <CheckCircle2 size={24} />}
                                </motion.div>
                                {hasOverdue && (
                                    <motion.span
                                        aria-hidden
                                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-300"
                                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.15, 0.85] }}
                                        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                                    />
                                )}
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                                    {todayCaption()}
                                </p>
                                <motion.h1
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ ...T.smooth, delay: 0.08 }}
                                    className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1"
                                >
                                    {greetingWord()}, {firstName}
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ ...T.smooth, delay: 0.14 }}
                                    className="mt-1.5 text-sm sm:text-base text-indigo-100/85 max-w-xl"
                                >
                                    {heroLine}
                                </motion.p>
                            </div>
                        </div>

                        {/* Workload glance cards */}
                        <div className="flex gap-3 flex-shrink-0">
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">To verify</p>
                                <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">{pendingDocs.length}</p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">To approve</p>
                                <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">{pendingAccounts.length}</p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">This week</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${dueThisWeek.length > 0 ? 'text-amber-300' : 'text-white'}`}>
                                    {dueThisWeek.length}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ─── 2-COL CONTENT ─────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* LEFT: Queues */}
                    <div className="lg:col-span-8 space-y-6">
                        <QueueSection
                            label="Verify documents"
                            count={pendingDocs.length}
                            accent="indigo"
                            icon={<FileText size={14} />}
                            emptyMessage="Nothing pending. Inbox clear."
                            viewAllHref="/admin/documents"
                        >
                            {pendingDocs.slice(0, 3).map((doc) => (
                                <QueueRow
                                    key={doc.id}
                                    accent="indigo"
                                    icon={<FileText size={16} />}
                                    title={doc.name}
                                    subtitle={`${doc.companyName} · ${doc.category} · uploaded ${relativeFromNow(doc.lastUpdated)}`}
                                    primary={{
                                        label: verifyDoc.isPending && verifyDoc.variables === doc.id ? 'Verifying…' : 'Verify',
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
                            accent="emerald"
                            icon={<UserPlus size={14} />}
                            emptyMessage="Nothing pending. You're caught up."
                            viewAllHref="/admin/accounts"
                        >
                            {pendingAccounts.slice(0, 3).map((acc) => (
                                <QueueRow
                                    key={acc.id}
                                    accent="emerald"
                                    icon={<UserPlus size={16} />}
                                    title={acc.name || acc.email}
                                    subtitle={`${acc.email}${acc.companyName ? ` · ${acc.companyName}` : ''}${acc.slaBreached ? ' · SLA breached' : ` · waiting ${Math.round(acc.pendingHours)}h`}`}
                                    primary={{
                                        label: approveAccount.isPending && approveAccount.variables === acc.id ? 'Approving…' : 'Approve',
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
                            accent="amber"
                            icon={<Clock size={14} />}
                            emptyMessage={`Nothing expiring in 7 days. ${dueIn30} due in next 30.`}
                            viewAllHref="/admin/companies"
                        >
                            {dueThisWeek.slice(0, 3).map((item) => (
                                <QueueRow
                                    key={item.id}
                                    accent="amber"
                                    icon={<Clock size={16} />}
                                    title={item.companyName}
                                    subtitle={`${item.documentName} · ${item.daysUntilExpiry < 0 ? `expired ${Math.abs(item.daysUntilExpiry)}d ago` : `expires in ${item.daysUntilExpiry}d`}`}
                                    primary={{
                                        label: 'Open client',
                                        href: `/admin/companies/${item.companyId}`,
                                    }}
                                    urgent={item.daysUntilExpiry < 0}
                                />
                            ))}
                        </QueueSection>
                    </div>

                    {/* RIGHT: Side panel */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Portfolio pulse */}
                        <motion.div
                            variants={fadeUp}
                            initial="hidden"
                            animate="show"
                            transition={{ ...T.smooth, delay: 0.1 }}
                            className="relative overflow-hidden rounded-2xl border border-[--color-border] bg-[--color-surface] p-5 card-shadow"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                                    <Activity size={14} />
                                </div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-[--color-text-muted]">
                                    Portfolio pulse
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                                <ForecastItem label="Clients" value={stats.totalCompanies} icon={<Building2 size={14} />} />
                                <ForecastItem label="Tender ready" value={stats.tenderReady} icon={<ShieldCheck size={14} />} tone="success" />
                                <ForecastItem label="Partially ready" value={stats.partiallyReady} icon={<AlertTriangle size={14} />} tone="warning" />
                                <ForecastItem label="High risk" value={stats.highRisk} icon={<AlertTriangle size={14} />} tone="danger" />
                                <ForecastItem label="Managed docs" value={stats.totalDocuments} icon={<FileCheck size={14} />} />
                                <ForecastItem label="Due in 30d" value={dueIn30} icon={<Clock size={14} />} />
                            </div>
                        </motion.div>

                        {/* Timeline */}
                        <motion.div
                            variants={fadeUp}
                            initial="hidden"
                            animate="show"
                            transition={{ ...T.smooth, delay: 0.15 }}
                            className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-5 card-shadow"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                                        <CalendarDays size={14} />
                                    </div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-[--color-text-muted]">
                                        Recent
                                    </h3>
                                </div>
                                <Link href="/admin/audit" className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                                    Full log <ArrowRight size={12} />
                                </Link>
                            </div>
                            {auditEntries.length === 0 ? (
                                <p className="text-sm text-[--color-text-muted]">No recent activity.</p>
                            ) : (
                                <ol className="relative pl-5 space-y-4">
                                    {/* Vertical timeline rail */}
                                    <span
                                        aria-hidden
                                        className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-gradient-to-b from-indigo-500/30 via-[--color-border] to-transparent"
                                    />
                                    {auditEntries.slice(0, 5).map((e, i) => (
                                        <li key={e.id} className="relative">
                                            <span
                                                className={`absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[--color-surface] ${i === 0 ? 'bg-indigo-500' : 'bg-[--color-border-strong]'}`}
                                            />
                                            <p className="text-[10px] text-[--color-text-muted] tabular-nums font-mono">
                                                {formatDateTime(e.timestamp)}
                                            </p>
                                            <p className="text-sm text-[--color-text-primary] mt-0.5">
                                                <span className="font-semibold">{e.actor}</span>
                                                <span className="text-[--color-text-muted]"> · {e.action}</span>
                                            </p>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
}
