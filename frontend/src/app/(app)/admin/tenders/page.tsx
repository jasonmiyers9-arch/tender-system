'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    FileText, Search, Filter, ArrowRight, Bell, CheckCircle2,
    Building2, Clock, Sparkles, Inbox, AlertCircle, Shield,
} from 'lucide-react';
import { useTenderMatches } from '@/lib/hooks/useTenders';
import { useAppStore } from '@/store/useAppStore';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { fadeUp, T, stagger } from '@/lib/motion';
import { formatDate } from '@/lib/utils/formatters';
import type { TenderMatch } from '@/lib/api/types';

type StatusKey = 'all' | 'published' | 'pending' | 'draft' | 'rejected' | 'expired' | 'new24h';

const STATUS_TONE: Record<string, { dot: string; chip: string; chipText: string; label: string }> = {
    published: { dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 border-emerald-500/30', chipText: 'text-emerald-600', label: 'Published' },
    pending: { dot: 'bg-amber-500', chip: 'bg-amber-500/10 border-amber-500/30', chipText: 'text-amber-600', label: 'Pending' },
    draft: { dot: 'bg-slate-400', chip: 'bg-slate-500/10 border-slate-500/30', chipText: 'text-slate-500', label: 'Draft' },
    rejected: { dot: 'bg-zinc-400', chip: 'bg-zinc-500/10 border-zinc-500/30', chipText: 'text-zinc-500', label: 'Rejected' },
    expired: { dot: 'bg-red-500', chip: 'bg-red-500/10 border-red-500/30', chipText: 'text-red-600', label: 'Expired' },
};

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

function deadlineLabel(deadline: string): { text: string; expired: boolean; soon: boolean } {
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
    if (Number.isNaN(diff)) return { text: formatDate(deadline), expired: false, soon: false };
    if (diff < 0) return { text: `Expired ${Math.abs(diff)}d ago`, expired: true, soon: false };
    if (diff === 0) return { text: 'Due today', expired: false, soon: true };
    if (diff <= 7) return { text: `Due in ${diff}d`, expired: false, soon: true };
    return { text: `Due ${formatDate(deadline)}`, expired: false, soon: false };
}

function sourceLabel(t: TenderMatch): string {
    if (!t.createdBy) return 'Scraped';
    return 'Evaluator';
}

function effectiveStatus(t: TenderMatch): string {
    const status = t.status ?? 'published';
    const deadlinePast = Math.ceil((new Date(t.deadline).getTime() - Date.now()) / 86_400_000) < 0;
    if (status === 'published' && deadlinePast) return 'expired';
    return status;
}

// ─── Status mutation (status-only PATCH) ─────────────────────────────────────
function useUpdateTenderStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, status }: { id: string; status: 'published' | 'rejected' | 'draft' }) => {
            const token = (() => {
                if (typeof window === 'undefined') return null;
                const raw = window.localStorage.getItem('tenderguard-app-state');
                if (!raw) return null;
                try { return JSON.parse(raw)?.state?.token ?? null; } catch { return null; }
            })();
            const res = await fetch(`/api/tenders/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error(`Update failed (${res.status})`);
            return res.json();
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tenders'] }),
    });
}

// ─── Pending queue row ───────────────────────────────────────────────────────
function PendingRow({ tender, onPublish, onReject, busy }: {
    tender: TenderMatch;
    onPublish: () => void;
    onReject: () => void;
    busy: boolean;
}) {
    const dl = deadlineLabel(tender.deadline);
    return (
        <motion.div
            variants={fadeUp}
            whileHover={{ y: -2 }}
            transition={T.snappy}
            className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-5 pr-4 py-3.5 rounded-xl bg-[--color-surface] border border-[--color-border] card-shadow before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-amber-500"
            style={{ backgroundImage: 'radial-gradient(120% 60% at -10% 50%, rgba(245,158,11,0.16), transparent 60%)' }}
        >
            <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/10 text-amber-600">
                    <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[--color-text-primary] truncate">{tender.title}</p>
                    <p className="text-xs text-[--color-text-muted] mt-0.5 truncate">
                        {tender.organization} · {sourceLabel(tender)} · submitted {relativeFromNow(tender.createdAt)} · {dl.text}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <Link href={`/tenders/${tender.id}`} className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text-primary] transition-colors">
                    View
                </Link>
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
                    onClick={onPublish}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:-translate-y-0.5"
                >
                    {busy ? 'Working…' : 'Publish'}
                </button>
            </div>
        </motion.div>
    );
}

// ─── Health pill ─────────────────────────────────────────────────────────────
function HealthTile({ label, value, icon, tone, active = false, onClick }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: 'success' | 'indigo' | 'danger' | 'muted';
    active?: boolean;
    onClick?: () => void;
}) {
    const cls = {
        success: 'ring-emerald-500/20 bg-emerald-500/5 text-emerald-600',
        indigo: 'ring-indigo-500/20 bg-indigo-500/5 text-indigo-600',
        danger: value > 0 ? 'ring-red-500/30 bg-red-500/8 text-red-600' : 'ring-[--color-border] bg-[--color-bg] text-[--color-text-muted]',
        muted: 'ring-[--color-border] bg-[--color-bg] text-[--color-text-primary]',
    }[tone];
    const activeRing = {
        success: 'ring-2 ring-emerald-500/60',
        indigo: 'ring-2 ring-indigo-500/60',
        danger: 'ring-2 ring-red-500/60',
        muted: 'ring-2 ring-[--color-border-strong]',
    }[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`flex-1 text-left px-4 py-3.5 rounded-xl ring-1 ${cls} ${active ? activeRing : ''} cursor-pointer transition-all hover:-translate-y-0.5 hover:ring-2 focus:outline-none focus:ring-2`}
        >
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted]">{label}</span>
            </div>
            <p className="text-2xl font-extrabold tabular-nums mt-1.5">{value}</p>
        </button>
    );
}

// ─── Tender card (clickable) ─────────────────────────────────────────────────
function TenderCard({ tender }: { tender: TenderMatch }) {
    const status = effectiveStatus(tender);
    const tone = STATUS_TONE[status] ?? STATUS_TONE.draft;
    const dl = deadlineLabel(tender.deadline);
    return (
        <Link href={`/tenders/${tender.id}`} className="group block">
            <motion.div
                variants={fadeUp}
                whileHover={{ y: -2 }}
                transition={T.snappy}
                className="relative overflow-hidden rounded-xl bg-[--color-surface] border border-[--color-border] hover:border-[--color-border-strong] card-shadow p-4 transition-colors"
            >
                <div className="flex items-start gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${tone.dot}`} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-[--color-text-primary] truncate">{tender.title}</p>
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase ${tone.chip} ${tone.chipText} flex-shrink-0`}>
                                {tone.label}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-[--color-text-muted]">
                            <span className="inline-flex items-center gap-1"><Building2 size={11} /> {tender.organization}</span>
                            <span>·</span>
                            <span>{sourceLabel(tender)}</span>
                            {tender.createdAt && <><span>·</span><span>{relativeFromNow(tender.createdAt)}</span></>}
                            {tender.category && <><span>·</span><span className="capitalize">{tender.category}</span></>}
                        </div>
                        <div className="flex items-center justify-between mt-2.5">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${dl.expired ? 'text-red-600' : dl.soon ? 'text-amber-600' : 'text-[--color-text-muted]'}`}>
                                <Clock size={11} /> {dl.text}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[--color-primary] opacity-0 group-hover:opacity-100 transition-opacity">
                                View <ArrowRight size={12} />
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AdminTenderFeedPage() {
    const currentUser = useAppStore((s) => s.currentUser);
    const { data: tenders, isLoading, isError, refetch } = useTenderMatches();
    const updateStatus = useUpdateTenderStatus();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<StatusKey>('all');

    const list = useMemo(() => tenders ?? [], [tenders]);

    const pending = useMemo(() => list.filter((t) => t.status === 'pending'), [list]);

    const [now] = useState(() => Date.now());
    const oneDayAgo = now - 86_400_000;
    const oneWeekAgo = now - 7 * 86_400_000;

    const publishedThisWeek = useMemo(
        () => list.filter((t) => (t.status ?? 'published') === 'published' && t.createdAt && new Date(t.createdAt).getTime() >= oneWeekAgo).length,
        [list, oneWeekAgo],
    );
    const newToday = useMemo(
        () => list.filter((t) => t.createdAt && new Date(t.createdAt).getTime() >= oneDayAgo).length,
        [list, oneDayAgo],
    );
    const pastDeadline = useMemo(
        () => list.filter((t) => effectiveStatus(t) === 'expired').length,
        [list],
    );
    const drafts = useMemo(() => list.filter((t) => t.status === 'draft').length, [list]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return list
            .filter((t) => {
                if (filter === 'all') return true;
                if (filter === 'new24h') return Boolean(t.createdAt) && new Date(t.createdAt!).getTime() >= oneDayAgo;
                return effectiveStatus(t) === filter;
            })
            .filter((t) => {
                if (!q) return true;
                return (
                    t.title.toLowerCase().includes(q) ||
                    t.organization.toLowerCase().includes(q) ||
                    (t.category ?? '').toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bT - aT;
            });
    }, [list, filter, search, oneDayAgo]);

    const focusFeed = (next: StatusKey) => {
        setFilter((curr) => (curr === next ? 'all' : next));
        if (typeof document !== 'undefined') {
            document.getElementById('all-tenders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const firstName =
        currentUser?.name?.split(' ')[0] ??
        currentUser?.email?.split('@')[0] ??
        'there';

    const hasUrgent = pending.length > 0 || pastDeadline > 0;
    const heroLine =
        pending.length === 0
            ? `Feed clean. ${publishedThisWeek} tender${publishedThisWeek === 1 ? '' : 's'} published this week.`
            : `${pending.length} awaiting your call · ${publishedThisWeek} published this week`;

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
            {/* Page backdrop */}
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
                                    Tender feed · {firstName}
                                </p>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                                    {pending.length === 0 ? 'Feed is flowing' : 'Pending your call'}
                                </h1>
                                <p className="mt-1.5 text-sm sm:text-base text-indigo-100/85 max-w-xl">
                                    {heroLine}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 flex-shrink-0">
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Awaiting</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${pending.length > 0 ? 'text-amber-300' : 'text-white'}`}>
                                    {pending.length}
                                </p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Drafts</p>
                                <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">{drafts}</p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Past due</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${pastDeadline > 0 ? 'text-red-300' : 'text-white'}`}>
                                    {pastDeadline}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ── PENDING QUEUE ────────────────────────────────────────── */}
                <section className="space-y-2.5">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
                        <h2 className="flex items-center gap-2 text-sm font-bold text-[--color-text-primary] tracking-tight">
                            <span className="text-amber-600"><Inbox size={14} /></span>
                            Awaiting your call
                        </h2>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase ${pending.length === 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-amber-500/10 border-amber-500/30 text-amber-600'}`}>
                            {pending.length === 0 ? 'All clear' : `${pending.length} pending`}
                        </span>
                    </div>

                    {pending.length === 0 ? (
                        <p className="pl-4 text-xs text-[--color-text-muted] italic">
                            <CheckCircle2 size={12} className="inline-block mr-1.5 -mt-0.5 text-emerald-500" />
                            Nothing waiting moderation. Feed clean.
                        </p>
                    ) : (
                        <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="space-y-2">
                            {pending.slice(0, 5).map((t) => (
                                <PendingRow
                                    key={t.id}
                                    tender={t}
                                    busy={updateStatus.isPending && updateStatus.variables?.id === t.id}
                                    onPublish={() => updateStatus.mutate({ id: t.id, status: 'published' })}
                                    onReject={() => {
                                        if (window.confirm(`Reject "${t.title}"? It will be hidden from clients.`)) {
                                            updateStatus.mutate({ id: t.id, status: 'rejected' });
                                        }
                                    }}
                                />
                            ))}
                        </motion.div>
                    )}
                </section>

                {/* ── FEED HEALTH ──────────────────────────────────────────── */}
                <section className="space-y-2.5">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600" />
                        <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">Feed health</h2>
                        <span className="text-[10px] text-[--color-text-muted] italic">tap a tile to filter</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <HealthTile label="Published this week" value={publishedThisWeek} icon={<CheckCircle2 size={14} />} tone="success" active={filter === 'published'} onClick={() => focusFeed('published')} />
                        <HealthTile label="New in last 24h" value={newToday} icon={<Sparkles size={14} />} tone="indigo" active={filter === 'new24h'} onClick={() => focusFeed('new24h')} />
                        <HealthTile label="Past deadline" value={pastDeadline} icon={<AlertCircle size={14} />} tone="danger" active={filter === 'expired'} onClick={() => focusFeed('expired')} />
                    </div>
                </section>

                {/* ── ALL TENDERS ──────────────────────────────────────────── */}
                <section id="all-tenders" className="space-y-3 scroll-mt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-slate-400 to-slate-600" />
                            <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">All tenders</h2>
                            <span className="text-xs text-[--color-text-muted]">{filtered.length} of {list.length}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search title, org, category"
                                    className="pl-9 pr-3 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-[240px] transition-colors"
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
                                    <option value="published">Published</option>
                                    <option value="new24h">New (24h)</option>
                                    <option value="pending">Pending</option>
                                    <option value="draft">Draft</option>
                                    <option value="expired">Expired</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[--color-border] bg-[--color-surface] p-10 text-center">
                            <p className="text-sm text-[--color-text-muted]">No tenders match your filters.</p>
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
                            {filtered.map((t) => (
                                <TenderCard key={t.id} tender={t} />
                            ))}
                        </motion.div>
                    )}
                </section>
            </div>
        </div>
    );
}
