'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
    UserPlus, Search, Filter, Bell, CheckCircle2, Shield, Sparkles,
    Inbox, AlertCircle, UserCheck, Users as UsersIcon, ShieldCheck, Mail,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
    useAdminAccounts,
    useInternalAdminUsers,
    useApproveAccount,
    useRejectAccount,
    useResetPendingAccount,
    useCreateInternalAdmin,
} from '@/lib/hooks/useAdmin';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { fadeUp, T, stagger } from '@/lib/motion';

type StatusKey = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_TONE: Record<string, { dot: string; chip: string; chipText: string; label: string }> = {
    approved: { dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 border-emerald-500/30', chipText: 'text-emerald-600', label: 'Approved' },
    pending: { dot: 'bg-amber-500', chip: 'bg-amber-500/10 border-amber-500/30', chipText: 'text-amber-600', label: 'Pending' },
    rejected: { dot: 'bg-red-500', chip: 'bg-red-500/10 border-red-500/30', chipText: 'text-red-600', label: 'Rejected' },
};

const ROLE_LABEL: Record<string, string> = {
    user: 'Company user',
    evaluator: 'Tender Provider',
    admin: 'Administrator',
};

function initials(name: string, email: string): string {
    const src = (name || email || '').trim();
    if (!src) return '?';
    const parts = src.split(/[ @._-]+/).filter(Boolean);
    if (parts.length === 0) return src[0]?.toUpperCase() ?? '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function relativeFromNow(iso?: string): string {
    if (!iso) return '';
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

// ─── Pending row ─────────────────────────────────────────────────────────────
interface SignupItem {
    id: string;
    name: string;
    email: string;
    role: string;
    verificationStatus: string;
    createdAt: string;
    companyName: string;
    pendingHours: number;
    slaBreached: boolean;
}

function PendingRow({ user, onApprove, onReject, busy }: {
    user: SignupItem;
    onApprove: () => void;
    onReject: () => void;
    busy: boolean;
}) {
    return (
        <motion.div
            variants={fadeUp}
            whileHover={{ y: -2 }}
            transition={T.snappy}
            className={`relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-5 pr-4 py-3.5 rounded-xl bg-[--color-surface] card-shadow before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-emerald-500 ${user.slaBreached ? 'ring-2 ring-amber-400/40' : 'border border-[--color-border]'}`}
            style={{ backgroundImage: 'radial-gradient(120% 60% at -10% 50%, rgba(16,185,129,0.16), transparent 60%)' }}
        >
            <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
                    {initials(user.name, user.email)}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[--color-text-primary] truncate">
                        {user.name || user.email}
                    </p>
                    <p className="text-xs text-[--color-text-muted] mt-0.5 truncate">
                        {user.email}
                        {user.companyName ? ` · ${user.companyName}` : ''} · {ROLE_LABEL[user.role] ?? user.role}
                    </p>
                    <p className={`text-[11px] mt-1 font-medium ${user.slaBreached ? 'text-amber-600' : 'text-[--color-text-muted]'}`}>
                        {user.slaBreached
                            ? `Waiting ${Math.round(user.pendingHours)}h · SLA breached`
                            : `Waiting ${Math.round(user.pendingHours)}h · within SLA`}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                    type="button"
                    onClick={onReject}
                    disabled={busy}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[--color-danger] hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                >
                    Reject
                </button>
                <button
                    type="button"
                    onClick={onApprove}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:-translate-y-0.5"
                >
                    {busy ? 'Working…' : 'Approve'}
                </button>
            </div>
        </motion.div>
    );
}

// ─── Pulse tile ──────────────────────────────────────────────────────────────
function PulseTile({ label, value, icon, tone }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: 'success' | 'warning' | 'danger' | 'muted';
}) {
    const cls = {
        success: 'ring-emerald-500/20 bg-emerald-500/5 text-emerald-600',
        warning: value > 0 ? 'ring-amber-500/30 bg-amber-500/8 text-amber-600' : 'ring-[--color-border] bg-[--color-bg] text-[--color-text-muted]',
        danger: value > 0 ? 'ring-red-500/30 bg-red-500/8 text-red-600' : 'ring-[--color-border] bg-[--color-bg] text-[--color-text-muted]',
        muted: 'ring-[--color-border] bg-[--color-bg] text-[--color-text-primary]',
    }[tone];
    return (
        <div className={`flex-1 px-4 py-3.5 rounded-xl ring-1 ${cls}`}>
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted]">{label}</span>
            </div>
            <p className="text-2xl font-extrabold tabular-nums mt-1.5">{value}</p>
        </div>
    );
}

// ─── Signup card (browser) ───────────────────────────────────────────────────
function SignupCard({ user, onResetPending, busy }: {
    user: SignupItem;
    onResetPending: () => void;
    busy: boolean;
}) {
    const tone = STATUS_TONE[user.verificationStatus] ?? STATUS_TONE.pending;
    return (
        <motion.div
            variants={fadeUp}
            whileHover={{ y: -1 }}
            transition={T.snappy}
            className="relative rounded-xl bg-[--color-surface] border border-[--color-border] hover:border-[--color-border-strong] card-shadow p-4 transition-colors"
        >
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px]" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
                    {initials(user.name, user.email)}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[--color-text-primary] truncate">
                            {user.name || user.email}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase ${tone.chip} ${tone.chipText} flex-shrink-0`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 -mt-0.5 align-middle ${tone.dot}`} />
                            {tone.label}
                        </span>
                    </div>
                    <p className="text-xs text-[--color-text-muted] mt-0.5 truncate">{user.email}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-[--color-text-muted]">
                        {user.companyName && <span>{user.companyName}</span>}
                        {user.companyName && <span>·</span>}
                        <span>{ROLE_LABEL[user.role] ?? user.role}</span>
                        {user.createdAt && <><span>·</span><span>signed up {relativeFromNow(user.createdAt)}</span></>}
                    </div>
                    {user.verificationStatus !== 'pending' && (
                        <button
                            type="button"
                            onClick={onResetPending}
                            disabled={busy}
                            className="mt-2 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-primary] hover:underline disabled:opacity-50 cursor-pointer"
                        >
                            Move back to pending
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AdminSignupsPage() {
    const currentUser = useAppStore((s) => s.currentUser);
    const accountsQuery = useAdminAccounts('all');
    const internalAdmins = useInternalAdminUsers();
    const approve = useApproveAccount();
    const reject = useRejectAccount();
    const resetPending = useResetPendingAccount();
    const createInternalAdmin = useCreateInternalAdmin();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<StatusKey>('all');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });

    const items = useMemo(() => (accountsQuery.data?.items ?? []) as SignupItem[], [accountsQuery.data?.items]);
    const adminItems = useMemo(() => internalAdmins.data?.items ?? [], [internalAdmins.data?.items]);

    const pending = useMemo(() => items.filter((u) => u.verificationStatus === 'pending'), [items]);
    const approvedCount = useMemo(() => items.filter((u) => u.verificationStatus === 'approved').length, [items]);
    const rejectedCount = useMemo(() => items.filter((u) => u.verificationStatus === 'rejected').length, [items]);
    const slaBreached = useMemo(() => pending.filter((u) => u.slaBreached).length, [pending]);

    const [monthAgo] = useState(() => Date.now() - 30 * 86_400_000);
    const onboardedThisMonth = useMemo(
        () => items.filter((u) => u.verificationStatus === 'approved' && u.createdAt && new Date(u.createdAt).getTime() >= monthAgo).length,
        [items, monthAgo],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items
            .filter((u) => (filter === 'all' ? true : u.verificationStatus === filter))
            .filter((u) => {
                if (!q) return true;
                return (
                    (u.name ?? '').toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    (u.companyName ?? '').toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bT - aT;
            });
    }, [items, filter, search]);

    const firstName =
        currentUser?.name?.split(' ')[0] ??
        currentUser?.email?.split('@')[0] ??
        'there';

    const hasUrgent = pending.length > 0 || slaBreached > 0;
    const heroLine =
        pending.length === 0
            ? `Inbox clear. ${approvedCount} active members${onboardedThisMonth > 0 ? ` · ${onboardedThisMonth} this month` : ''}.`
            : `${pending.length} pending · ${slaBreached} SLA-breached · ${onboardedThisMonth} onboarded this month`;

    const closeCreateModal = () => {
        if (createInternalAdmin.isPending) return;
        setCreateModalOpen(false);
        setCreateError(null);
        setFormData({ name: '', email: '', password: '' });
    };

    const handleCreateInternalAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);
        if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
            setCreateError('Name, email, and password are required.');
            return;
        }
        if (formData.password.trim().length < 8) {
            setCreateError('Password must be at least 8 characters long.');
            return;
        }
        try {
            await createInternalAdmin.mutateAsync({
                name: formData.name.trim(),
                email: formData.email.trim(),
                password: formData.password,
            });
            closeCreateModal();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create internal admin account.');
        }
    };

    if (accountsQuery.isLoading) {
        return (
            <div className="space-y-6 max-w-[1280px] mx-auto">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
        );
    }

    if (accountsQuery.isError) return <ErrorState onRetry={() => accountsQuery.refetch()} />;

    return (
        <div className="relative">
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 -z-10"
                style={{
                    backgroundImage:
                        'radial-gradient(800px 500px at 0% -10%, rgba(79,70,229,0.10), transparent 60%), radial-gradient(700px 400px at 100% 0%, rgba(124,58,237,0.08), transparent 55%)',
                }}
            />

            <div className="space-y-6 max-w-[1280px] mx-auto">
                {/* ── HERO ─────────────────────────────────────────────────── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="relative overflow-hidden rounded-3xl border border-white/5 px-6 py-7 sm:px-9 sm:py-9"
                    style={{ background: 'linear-gradient(135deg, #0F0A2E 0%, #1E1B4B 35%, #312E81 65%, #1E3A5C 100%)' }}
                >
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
                    <motion.div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.10) 50%, transparent 70%)',
                            backgroundSize: '200% 100%',
                        }}
                        animate={{ backgroundPosition: ['-100% 0%', '200% 0%'] }}
                        transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                    />
                    <div
                        aria-hidden
                        className="absolute inset-0 opacity-[0.07]"
                        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                    />
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
                            <div className="relative">
                                <motion.div
                                    initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
                                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                    transition={{ ...T.softSpring, delay: 0.05 }}
                                    className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-white"
                                    style={{
                                        background: hasUrgent
                                            ? 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)'
                                            : 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                                        boxShadow: hasUrgent
                                            ? '0 8px 28px rgba(245,158,11,0.45)'
                                            : '0 8px 28px rgba(16,185,129,0.45)',
                                    }}
                                >
                                    {hasUrgent ? <Bell size={24} /> : <Sparkles size={24} />}
                                </motion.div>
                                {hasUrgent && (
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
                                    Signups · {firstName}
                                </p>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                                    {pending.length === 0 ? 'Inbox clear' : 'Signups awaiting you'}
                                </h1>
                                <p className="mt-1.5 text-sm sm:text-base text-indigo-100/85 max-w-xl">
                                    {heroLine}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 flex-shrink-0">
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Pending</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${pending.length > 0 ? 'text-amber-300' : 'text-white'}`}>
                                    {pending.length}
                                </p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">SLA breach</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${slaBreached > 0 ? 'text-red-300' : 'text-white'}`}>
                                    {slaBreached}
                                </p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Team</p>
                                <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">{adminItems.length}</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ── PENDING QUEUE ────────────────────────────────────────── */}
                <section className="space-y-2.5">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
                        <h2 className="flex items-center gap-2 text-sm font-bold text-[--color-text-primary] tracking-tight">
                            <span className="text-emerald-600"><Inbox size={14} /></span>
                            Awaiting your call
                        </h2>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase ${pending.length === 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'}`}>
                            {pending.length === 0 ? 'All clear' : `${pending.length} pending`}
                        </span>
                    </div>

                    {pending.length === 0 ? (
                        <p className="pl-4 text-xs text-[--color-text-muted] italic">
                            <CheckCircle2 size={12} className="inline-block mr-1.5 -mt-0.5 text-emerald-500" />
                            Nothing pending. {approvedCount} active members.
                        </p>
                    ) : (
                        <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="space-y-2">
                            {pending.slice(0, 6).map((u) => (
                                <PendingRow
                                    key={u.id}
                                    user={u}
                                    busy={(approve.isPending && approve.variables === u.id) || (reject.isPending && reject.variables?.userId === u.id)}
                                    onApprove={() => approve.mutate(u.id)}
                                    onReject={() => {
                                        const reason = window.prompt(`Reject ${u.name || u.email}?\n\nOptional reason:`) ?? null;
                                        if (reason === null) return; // cancelled
                                        reject.mutate({ userId: u.id, reason: reason || undefined });
                                    }}
                                />
                            ))}
                        </motion.div>
                    )}
                </section>

                {/* ── SIGN-UP PULSE ────────────────────────────────────────── */}
                <section className="space-y-2.5">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600" />
                        <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">Sign-up pulse</h2>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <PulseTile label="Pending now" value={pending.length} icon={<Inbox size={14} />} tone="warning" />
                        <PulseTile label="SLA breached" value={slaBreached} icon={<AlertCircle size={14} />} tone="danger" />
                        <PulseTile label="Approved (total)" value={approvedCount} icon={<UserCheck size={14} />} tone="success" />
                        <PulseTile label="Rejected (total)" value={rejectedCount} icon={<AlertCircle size={14} />} tone="muted" />
                    </div>
                </section>

                {/* ── 2-COL: All signups + Team ────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-slate-400 to-slate-600" />
                                <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">All signups</h2>
                                <span className="text-xs text-[--color-text-muted]">{filtered.length} of {items.length}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Name, email, company"
                                        className="pl-9 pr-3 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 w-[220px] transition-colors"
                                    />
                                </div>
                                <div className="relative">
                                    <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
                                    <select
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value as StatusKey)}
                                        className="appearance-none pl-9 pr-8 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                    >
                                        <option value="all">All</option>
                                        <option value="pending">Pending</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-[--color-border] bg-[--color-surface] p-10 text-center">
                                <p className="text-sm text-[--color-text-muted]">No signups match your filters.</p>
                                <button
                                    type="button"
                                    onClick={() => { setSearch(''); setFilter('all'); }}
                                    className="mt-2 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                                >
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filtered.map((u) => (
                                    <SignupCard
                                        key={u.id}
                                        user={u}
                                        busy={resetPending.isPending && resetPending.variables === u.id}
                                        onResetPending={() => {
                                            if (window.confirm(`Move ${u.name || u.email} back to pending?`)) {
                                                resetPending.mutate(u.id);
                                            }
                                        }}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </div>

                    {/* Team panel */}
                    <div className="lg:col-span-4">
                        <motion.div
                            variants={fadeUp}
                            initial="hidden"
                            animate="show"
                            transition={{ ...T.smooth, delay: 0.1 }}
                            className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-5 card-shadow"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                                        <ShieldCheck size={14} />
                                    </div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-[--color-text-muted]">
                                        Team
                                    </h3>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted]">
                                    {adminItems.length} operator{adminItems.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            {internalAdmins.isLoading ? (
                                <p className="text-xs text-[--color-text-muted]">Loading…</p>
                            ) : adminItems.length === 0 ? (
                                <p className="text-xs text-[--color-text-muted]">No operators provisioned yet.</p>
                            ) : (
                                <ul className="space-y-2.5">
                                    {adminItems.map((u) => (
                                        <li key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-[--color-border] hover:border-[--color-border-strong] transition-colors">
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px]" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
                                                {initials(u.name, u.email)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-[--color-text-primary] truncate">{u.name}</p>
                                                <p className="text-[11px] text-[--color-text-muted] truncate flex items-center gap-1">
                                                    <Mail size={10} /> {u.email}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <button
                                type="button"
                                onClick={() => setCreateModalOpen(true)}
                                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-indigo-600 border border-dashed border-indigo-500/40 hover:bg-indigo-500/5 transition-colors cursor-pointer"
                            >
                                <UserPlus size={13} /> Add operator
                            </button>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* ── Create Internal Admin modal (unchanged behaviour, restyled label) ─ */}
            <Modal
                open={createModalOpen}
                onClose={closeCreateModal}
                title="Add operator"
                size="md"
                footer={
                    <>
                        <Button variant="ghost" onClick={closeCreateModal} disabled={createInternalAdmin.isPending}>
                            Cancel
                        </Button>
                        <Button form="create-internal-admin-form" type="submit" loading={createInternalAdmin.isPending} leftIcon={<ShieldCheck size={14} />}>
                            Create
                        </Button>
                    </>
                }
            >
                <form id="create-internal-admin-form" className="space-y-4" onSubmit={handleCreateInternalAdmin}>
                    <p className="text-sm text-[--color-text-muted]">
                        Provisions a Firebase Auth account plus an internal admin record. Share the password securely, rotate later.
                    </p>

                    {createError && (
                        <div className="rounded-xl border border-red-200 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10 px-4 py-3">
                            <p className="text-xs font-medium text-red-700 dark:text-red-400">{createError}</p>
                        </div>
                    )}

                    <Input
                        label="Full name"
                        placeholder="e.g. Platform Ops Lead"
                        value={formData.name}
                        onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))}
                        required
                    />
                    <Input
                        type="email"
                        label="Work email"
                        placeholder="ops@tenderguard.co.za"
                        value={formData.email}
                        onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
                        required
                    />
                    <Input
                        type="password"
                        label="Temporary password"
                        placeholder="At least 8 characters"
                        hint="Share securely. Rotate later."
                        value={formData.password}
                        onChange={(e) => setFormData((current) => ({ ...current, password: e.target.value }))}
                        required
                    />
                </form>
            </Modal>
        </div>
    );
}
