'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
    Search, Filter, ArrowRight, ArrowUpRight, Mail, Bell, Sparkles, Shield,
    ShieldCheck, ShieldOff, AlertTriangle, AlertCircle, Building2, FileCheck, Inbox,
} from 'lucide-react';
import { useAdminCompanies, useAdminDashboard, useUpdateAdminCompany } from '@/lib/hooks/useAdmin';
import { useAppStore } from '@/store/useAppStore';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { fadeUp, T, stagger } from '@/lib/motion';
import type { Company } from '@/lib/api/types';

type StatusKey = 'all' | 'verified' | 'pending' | 'rejected';
type SortKey = 'name' | 'recent' | 'risk';

const STATUS_TONE: Record<Company['status'], {
    dot: string;
    chip: string;
    chipText: string;
    label: string;
    edge: string;
    glow: string;
    avatar: string;
}> = {
    verified: {
        dot: 'bg-emerald-500',
        chip: 'bg-emerald-500/10 border-emerald-500/30',
        chipText: 'text-emerald-600',
        label: 'Verified',
        edge: 'before:bg-emerald-500',
        glow: 'rgba(16,185,129,0.14)',
        avatar: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
    },
    pending: {
        dot: 'bg-amber-500',
        chip: 'bg-amber-500/10 border-amber-500/30',
        chipText: 'text-amber-600',
        label: 'Pending CIPC',
        edge: 'before:bg-amber-500',
        glow: 'rgba(245,158,11,0.14)',
        avatar: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
    },
    rejected: {
        dot: 'bg-red-500',
        chip: 'bg-red-500/10 border-red-500/30',
        chipText: 'text-red-600',
        label: 'Rejected',
        edge: 'before:bg-red-500',
        glow: 'rgba(239,68,68,0.14)',
        avatar: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
    },
};

function initials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

// ─── Pulse tile (clickable filter) ───────────────────────────────────────────
function PulseTile({ label, value, icon, tone, active, onClick }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: 'success' | 'warning' | 'danger' | 'muted';
    active?: boolean;
    onClick?: () => void;
}) {
    const cls = {
        success: value > 0 ? 'ring-emerald-500/30 bg-emerald-500/8 text-emerald-600' : 'ring-[--color-border] bg-[--color-bg] text-[--color-text-muted]',
        warning: value > 0 ? 'ring-amber-500/30 bg-amber-500/8 text-amber-600' : 'ring-[--color-border] bg-[--color-bg] text-[--color-text-muted]',
        danger: value > 0 ? 'ring-red-500/30 bg-red-500/8 text-red-600' : 'ring-[--color-border] bg-[--color-bg] text-[--color-text-muted]',
        muted: 'ring-[--color-border] bg-[--color-bg] text-[--color-text-primary]',
    }[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 text-left px-4 py-3.5 rounded-xl ring-1 transition-all hover:-translate-y-0.5 cursor-pointer ${cls} ${active ? 'ring-2 shadow-md' : ''}`}
        >
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted]">{label}</span>
            </div>
            <p className="text-2xl font-extrabold tabular-nums mt-1.5">{value}</p>
        </button>
    );
}

// ─── Client card ─────────────────────────────────────────────────────────────
function ClientCard({ c, onQuickAction, busy }: {
    c: Company;
    onQuickAction: (companyId: string, next: Company['status']) => void;
    busy: boolean;
}) {
    const tone = STATUS_TONE[c.status] ?? STATUS_TONE.pending;
    return (
        <motion.div
            variants={fadeUp}
            whileHover={{ y: -2 }}
            transition={T.snappy}
            className={`group relative overflow-hidden rounded-xl bg-[--color-surface] border border-[--color-border] hover:border-[--color-border-strong] card-shadow transition-colors before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 ${tone.edge}`}
            style={{ backgroundImage: `radial-gradient(120% 60% at -10% 50%, ${tone.glow}, transparent 60%)` }}
        >
            <Link href={`/admin/companies/${c.id}`} className="block p-4 pl-5">
                <div className="flex items-start gap-3">
                    <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-sm"
                        style={{ background: tone.avatar }}
                    >
                        {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-[--color-text-primary] truncate">{c.name}</p>
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase ${tone.chip} ${tone.chipText} flex-shrink-0`}>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 -mt-0.5 align-middle ${tone.dot}`} />
                                {tone.label}
                            </span>
                        </div>
                        <p className="text-[11px] text-[--color-text-muted] mt-0.5 font-mono">{c.registrationNumber || '—'}</p>

                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {c.industry && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[--color-bg] text-[--color-text-muted] border border-[--color-border]">
                                    {c.industry}
                                </span>
                            )}
                            {c.province && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[--color-bg] text-[--color-text-muted] border border-[--color-border]">
                                    {c.province}
                                </span>
                            )}
                            {c.bbbeeLevel && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                    B-BBEE {c.bbbeeLevel}
                                </span>
                            )}
                            {c.cidbGrade && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                    CIDB {c.cidbGrade}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[--color-border] gap-2">
                            {c.email ? (
                                <span
                                    className="inline-flex items-center gap-1 text-[11px] text-[--color-text-muted] truncate max-w-[160px]"
                                    onClick={(ev) => {
                                        ev.preventDefault();
                                        ev.stopPropagation();
                                        window.location.href = `mailto:${c.email}`;
                                    }}
                                    role="link"
                                    tabIndex={0}
                                >
                                    <Mail size={11} /> {c.email}
                                </span>
                            ) : (
                                <span className="text-[11px] text-[--color-text-muted] italic">No contact email</span>
                            )}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                {c.status === 'pending' && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={(ev) => {
                                            ev.preventDefault();
                                            ev.stopPropagation();
                                            onQuickAction(c.id, 'verified');
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        <ShieldCheck size={10} /> Verify
                                    </button>
                                )}
                                {c.status === 'verified' && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={(ev) => {
                                            ev.preventDefault();
                                            ev.stopPropagation();
                                            if (window.confirm(`Suspend ${c.name}?`)) onQuickAction(c.id, 'rejected');
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        <ShieldOff size={10} /> Suspend
                                    </button>
                                )}
                                {c.status === 'rejected' && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={(ev) => {
                                            ev.preventDefault();
                                            ev.stopPropagation();
                                            onQuickAction(c.id, 'pending');
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-amber-600 hover:bg-amber-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        <Sparkles size={10} /> Reactivate
                                    </button>
                                )}
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[--color-primary] opacity-0 group-hover:opacity-100 transition-opacity">
                                    Open <ArrowRight size={12} />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AdminPortfolioPage() {
    const currentUser = useAppStore((s) => s.currentUser);
    const { data: companies, isLoading, isError, refetch } = useAdminCompanies();
    const statsQuery = useAdminDashboard();
    const updateCompany = useUpdateAdminCompany();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
    const [sortBy, setSortBy] = useState<SortKey>('name');

    const list = useMemo(() => (Array.isArray(companies) ? companies : []), [companies]);

    const verifiedCount = useMemo(() => list.filter((c) => c.status === 'verified').length, [list]);
    const pendingCount = useMemo(() => list.filter((c) => c.status === 'pending').length, [list]);
    const rejectedCount = useMemo(() => list.filter((c) => c.status === 'rejected').length, [list]);

    const stats = statsQuery.data;
    const tenderReady = stats?.tenderReady ?? 0;
    const partiallyReady = stats?.partiallyReady ?? 0;
    const highRisk = stats?.highRisk ?? 0;
    const atRisk = partiallyReady + highRisk;

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const out = list.filter((c) => {
            if (statusFilter !== 'all' && c.status !== statusFilter) return false;
            if (!q) return true;
            return (
                c.name.toLowerCase().includes(q) ||
                (c.registrationNumber ?? '').toLowerCase().includes(q) ||
                (c.vatNumber ?? '').toLowerCase().includes(q) ||
                (c.csdNumber ?? '').toLowerCase().includes(q) ||
                (c.industry ?? '').toLowerCase().includes(q) ||
                (c.province ?? '').toLowerCase().includes(q) ||
                (c.email ?? '').toLowerCase().includes(q)
            );
        });
        if (sortBy === 'name') {
            out.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'recent') {
            out.sort((a, b) => {
                const aT = a.incorporatedDate ? new Date(a.incorporatedDate).getTime() : 0;
                const bT = b.incorporatedDate ? new Date(b.incorporatedDate).getTime() : 0;
                return bT - aT;
            });
        } else if (sortBy === 'risk') {
            const rank: Record<Company['status'], number> = { rejected: 0, pending: 1, verified: 2 };
            out.sort((a, b) => (rank[a.status] ?? 99) - (rank[b.status] ?? 99));
        }
        return out;
    }, [list, search, statusFilter, sortBy]);

    const firstName =
        currentUser?.name?.split(' ')[0] ??
        currentUser?.email?.split('@')[0] ??
        'there';

    const hasRisk = atRisk > 0 || pendingCount > 0 || rejectedCount > 0;
    const heroLine = list.length === 0
        ? 'No clients yet — once they sign up and pass CIPC checks, they appear here.'
        : `${list.length} client${list.length === 1 ? '' : 's'} · ${atRisk} at risk · ${tenderReady} tender-ready · ${pendingCount} pending CIPC`;

    const togglePulse = (next: StatusKey) => {
        setStatusFilter((curr) => (curr === next ? 'all' : next));
    };

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-[1280px] mx-auto">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
        );
    }

    if (isError) return <ErrorState onRetry={refetch} />;

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
                                        background: hasRisk
                                            ? 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)'
                                            : 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                                        boxShadow: hasRisk
                                            ? '0 8px 28px rgba(245,158,11,0.45)'
                                            : '0 8px 28px rgba(16,185,129,0.45)',
                                    }}
                                >
                                    {hasRisk ? <Bell size={24} /> : <Sparkles size={24} />}
                                </motion.div>
                                {hasRisk && (
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
                                    Portfolio · {firstName}
                                </p>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                                    {hasRisk ? 'Clients need attention' : 'Your client portfolio'}
                                </h1>
                                <p className="mt-1.5 text-sm sm:text-base text-indigo-100/85 max-w-xl">
                                    {heroLine}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 flex-shrink-0">
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Tender-ready</p>
                                <p className="text-2xl font-extrabold text-emerald-300 mt-1 tabular-nums">{tenderReady}</p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">At risk</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${atRisk > 0 ? 'text-amber-300' : 'text-white'}`}>
                                    {atRisk}
                                </p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Pending CIPC</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${pendingCount > 0 ? 'text-amber-300' : 'text-white'}`}>
                                    {pendingCount}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ── PORTFOLIO PULSE (clickable filter tiles) ─────────────── */}
                <section className="space-y-2.5">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600" />
                        <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">Portfolio pulse</h2>
                        <span className="text-[10px] text-[--color-text-muted] italic">tap a tile to filter</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <PulseTile
                            label="Tender-ready"
                            value={tenderReady}
                            icon={<ShieldCheck size={14} />}
                            tone="success"
                            active={statusFilter === 'verified' && tenderReady > 0}
                            onClick={() => togglePulse('verified')}
                        />
                        <PulseTile
                            label="Partially ready"
                            value={partiallyReady}
                            icon={<AlertTriangle size={14} />}
                            tone="warning"
                            onClick={() => togglePulse('verified')}
                        />
                        <PulseTile
                            label="High risk"
                            value={highRisk}
                            icon={<AlertCircle size={14} />}
                            tone="danger"
                            onClick={() => togglePulse('rejected')}
                            active={statusFilter === 'rejected' && highRisk > 0}
                        />
                        <PulseTile
                            label="Pending CIPC"
                            value={pendingCount}
                            icon={<Inbox size={14} />}
                            tone="warning"
                            active={statusFilter === 'pending' && pendingCount > 0}
                            onClick={() => togglePulse('pending')}
                        />
                    </div>
                </section>

                {/* ── CLIENT BOOK ──────────────────────────────────────────── */}
                <section className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-slate-400 to-slate-600" />
                            <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">Client book</h2>
                            <span className="text-xs text-[--color-text-muted]">{filtered.length} of {list.length}</span>
                            {statusFilter !== 'all' && (
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('all')}
                                    className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                                >
                                    Clear filter
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Name, reg, VAT, CSD, industry"
                                    className="pl-9 pr-3 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-[240px] transition-colors"
                                />
                            </div>
                            <div className="relative">
                                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as StatusKey)}
                                    className="appearance-none pl-9 pr-8 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="all">All status</option>
                                    <option value="verified">Verified</option>
                                    <option value="pending">Pending CIPC</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <div className="relative">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                                    className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="name">Sort: A→Z</option>
                                    <option value="recent">Sort: Newest</option>
                                    <option value="risk">Sort: Risk first</option>
                                </select>
                            </div>
                            <Link
                                href="/admin/documents"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-500/30 hover:bg-indigo-500/5 transition-colors"
                            >
                                <FileCheck size={13} /> Review docs <ArrowUpRight size={11} />
                            </Link>
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[--color-border] bg-[--color-surface] p-10 text-center">
                            <Building2 size={28} className="mx-auto text-[--color-text-muted] mb-2 opacity-60" />
                            <p className="text-sm text-[--color-text-muted]">No clients match.</p>
                            <button
                                type="button"
                                onClick={() => { setSearch(''); setStatusFilter('all'); setSortBy('name'); }}
                                className="mt-2 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                            >
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <motion.div
                            variants={stagger(0.04)}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-1 md:grid-cols-2 gap-3"
                        >
                            {filtered.map((c) => (
                                <ClientCard
                                    key={c.id}
                                    c={c}
                                    busy={updateCompany.isPending && updateCompany.variables?.companyId === c.id}
                                    onQuickAction={(companyId, next) => updateCompany.mutate({ companyId, payload: { status: next } })}
                                />
                            ))}
                        </motion.div>
                    )}
                </section>
            </div>
        </div>
    );
}
