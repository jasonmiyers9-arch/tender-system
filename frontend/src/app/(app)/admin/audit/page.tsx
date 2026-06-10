'use client';

import { useMemo, useState, Fragment } from 'react';
import { motion } from 'motion/react';
import {
    Search, Filter, Calendar, Download, Bell, Sparkles, Shield,
    UserCheck, FileCheck, XCircle, Inbox, ChevronDown, Activity,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useAuditLog } from '@/lib/hooks/useAdmin';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { fadeUp, T, stagger } from '@/lib/motion';
import type { AuditEntry } from '@/lib/api/types';

type EntityKey = 'all' | 'user' | 'document';
type RangeKey = 'today' | '7d' | '30d' | 'all';
type ActionKey = 'all' | 'approved' | 'rejected' | 'uploaded' | 'verified';

const ENTITY_TONE: Record<string, { dot: string; chip: string; text: string; label: string }> = {
    user: { dot: 'bg-indigo-500', chip: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-600', label: 'Account' },
    tax: { dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-600', label: 'Tax' },
    legal: { dot: 'bg-slate-500', chip: 'bg-slate-500/10 border-slate-500/30', text: 'text-slate-600', label: 'Legal' },
    financial: { dot: 'bg-violet-500', chip: 'bg-violet-500/10 border-violet-500/30', text: 'text-violet-600', label: 'Financial' },
    certification: { dot: 'bg-cyan-500', chip: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-600', label: 'Certification' },
    bbbee: { dot: 'bg-amber-500', chip: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-600', label: 'B-BBEE' },
    registration: { dot: 'bg-indigo-500', chip: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-600', label: 'Registration' },
    policy: { dot: 'bg-rose-500', chip: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-600', label: 'Policy' },
};

const DOCUMENT_CATS = new Set(['tax', 'legal', 'financial', 'certification', 'bbbee', 'registration', 'policy']);

function initials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function dayBucket(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86_400_000;
    const t = date.getTime();
    if (t >= startOfToday) return 'Today';
    if (t >= startOfYesterday) return 'Yesterday';
    return date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: t < startOfToday - 365 * 86_400_000 ? 'numeric' : undefined });
}

function timeOnly(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function tone(entity: string) {
    return ENTITY_TONE[entity] ?? ENTITY_TONE.legal;
}

function downloadCsv(entries: AuditEntry[]) {
    const header = ['Timestamp (ISO)', 'Actor', 'Action', 'Entity', 'EntityID', 'Metadata'];
    const rows = entries.map((e) => [
        e.timestamp,
        e.actor,
        e.action,
        e.entity,
        e.entityId,
        JSON.stringify(e.metadata ?? {}),
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenderguard-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ─── Pulse tile ──────────────────────────────────────────────────────────────
function PulseTile({ label, value, icon, tone: t, active, onClick }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: 'indigo' | 'slate' | 'danger' | 'success';
    active?: boolean;
    onClick: () => void;
}) {
    const cls = {
        indigo: 'ring-indigo-500/30 bg-indigo-500/5 text-indigo-600',
        slate: 'ring-[--color-border] bg-[--color-bg] text-[--color-text-primary]',
        danger: value > 0 ? 'ring-red-500/30 bg-red-500/8 text-red-600' : 'ring-[--color-border] bg-[--color-bg] text-[--color-text-muted]',
        success: value > 0 ? 'ring-emerald-500/30 bg-emerald-500/8 text-emerald-600' : 'ring-[--color-border] bg-[--color-bg] text-[--color-text-muted]',
    }[t];
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

// ─── Entry row ───────────────────────────────────────────────────────────────
function EntryRow({ entry }: { entry: AuditEntry }) {
    const [open, setOpen] = useState(false);
    const t = tone(entry.entity);
    const hasMeta = entry.metadata && Object.keys(entry.metadata).length > 0;
    return (
        <motion.div variants={fadeUp} className="relative pl-7">
            <span className={`absolute left-[7px] top-2.5 w-3 h-3 rounded-full border-2 border-[--color-surface] ${t.dot}`} />
            <div className="rounded-xl bg-[--color-surface] border border-[--color-border] hover:border-[--color-border-strong] transition-colors p-3.5">
                <div className="flex items-start gap-3">
                    <span className="text-[11px] text-[--color-text-muted] tabular-nums font-mono w-12 mt-0.5 flex-shrink-0">
                        {timeOnly(entry.timestamp)}
                    </span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px]" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
                        {initials(entry.actor)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-[--color-text-primary]">
                            <span className="font-semibold">{entry.actor}</span>{' '}
                            <span className="text-[--color-text-muted]">{entry.action}</span>
                        </p>
                        {hasMeta && open && (
                            <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                {Object.entries(entry.metadata).map(([k, v]) => (
                                    <div key={k} className="flex gap-2 min-w-0">
                                        <dt className="text-[--color-text-muted] capitalize flex-shrink-0">{k}:</dt>
                                        <dd className="text-[--color-text-primary] truncate font-mono">{String(v)}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase ${t.chip} ${t.text} flex-shrink-0`}>
                        {t.label}
                    </span>
                    {hasMeta && (
                        <button
                            type="button"
                            onClick={() => setOpen((o) => !o)}
                            className="p-1 rounded-md text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text-primary] cursor-pointer transition-colors flex-shrink-0"
                            aria-label={open ? 'Collapse details' : 'Expand details'}
                        >
                            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={T.snappy}>
                                <ChevronDown size={14} />
                            </motion.span>
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AdminActivityPage() {
    const currentUser = useAppStore((s) => s.currentUser);
    const { data, isLoading, isError, refetch } = useAuditLog(1, 200);

    const [search, setSearch] = useState('');
    const [entityFilter, setEntityFilter] = useState<EntityKey>('all');
    const [rangeFilter, setRangeFilter] = useState<RangeKey>('all');
    const [actionFilter, setActionFilter] = useState<ActionKey>('all');

    const entries = useMemo(() => data?.entries ?? [], [data?.entries]);
    const total = data?.total ?? entries.length;

    const [now] = useState(() => Date.now());
    const startOfToday = useMemo(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }, []);
    const weekAgo = now - 7 * 86_400_000;
    const monthAgo = now - 30 * 86_400_000;

    const todayCount = useMemo(
        () => entries.filter((e) => new Date(e.timestamp).getTime() >= startOfToday).length,
        [entries, startOfToday],
    );
    const weekCount = useMemo(
        () => entries.filter((e) => new Date(e.timestamp).getTime() >= weekAgo).length,
        [entries, weekAgo],
    );
    const rejectionsMonth = useMemo(
        () => entries.filter((e) => /reject/i.test(e.action) && new Date(e.timestamp).getTime() >= monthAgo).length,
        [entries, monthAgo],
    );
    const newAccountsMonth = useMemo(
        () => entries.filter((e) => e.entity === 'user' && /approved/i.test(e.action) && new Date(e.timestamp).getTime() >= monthAgo).length,
        [entries, monthAgo],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return entries.filter((e) => {
            if (q && !(e.actor.toLowerCase().includes(q) || e.action.toLowerCase().includes(q))) return false;
            if (entityFilter === 'user' && e.entity !== 'user') return false;
            if (entityFilter === 'document' && !DOCUMENT_CATS.has(e.entity)) return false;
            const t = new Date(e.timestamp).getTime();
            if (rangeFilter === 'today' && t < startOfToday) return false;
            if (rangeFilter === '7d' && t < weekAgo) return false;
            if (rangeFilter === '30d' && t < monthAgo) return false;
            if (actionFilter !== 'all' && !e.action.toLowerCase().includes(actionFilter)) return false;
            return true;
        });
    }, [entries, search, entityFilter, rangeFilter, actionFilter, startOfToday, weekAgo, monthAgo]);

    const grouped = useMemo(() => {
        const map = new Map<string, AuditEntry[]>();
        for (const e of filtered) {
            const key = dayBucket(e.timestamp);
            const arr = map.get(key);
            if (arr) arr.push(e);
            else map.set(key, [e]);
        }
        return Array.from(map.entries());
    }, [filtered]);

    const firstName =
        currentUser?.name?.split(' ')[0] ??
        currentUser?.email?.split('@')[0] ??
        'there';

    const hasActivity = todayCount > 0;
    const heroLine = total === 0
        ? 'No activity tracked yet.'
        : `${total} events tracked · ${todayCount} today · ${weekCount} this week`;

    const clearFilters = () => {
        setSearch('');
        setEntityFilter('all');
        setRangeFilter('all');
        setActionFilter('all');
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
                                        background: hasActivity
                                            ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
                                            : 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                                        boxShadow: hasActivity
                                            ? '0 8px 28px rgba(79,70,229,0.45)'
                                            : '0 8px 28px rgba(16,185,129,0.45)',
                                    }}
                                >
                                    {hasActivity ? <Activity size={24} /> : <Sparkles size={24} />}
                                </motion.div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                                    Activity history · {firstName}
                                </p>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                                    {hasActivity ? 'Live trail' : 'All quiet'}
                                </h1>
                                <p className="mt-1.5 text-sm sm:text-base text-indigo-100/85 max-w-xl">
                                    {heroLine}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 flex-shrink-0">
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Today</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${todayCount > 0 ? 'text-indigo-200' : 'text-white'}`}>
                                    {todayCount}
                                </p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">This week</p>
                                <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">{weekCount}</p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Rejects 30d</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${rejectionsMonth > 0 ? 'text-red-300' : 'text-white'}`}>
                                    {rejectionsMonth}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ── PULSE ────────────────────────────────────────────────── */}
                <section className="space-y-2.5">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600" />
                        <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">At a glance</h2>
                        <span className="text-[10px] text-[--color-text-muted] italic">tap a tile to filter</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <PulseTile
                            label="Today"
                            value={todayCount}
                            icon={<Inbox size={14} />}
                            tone="indigo"
                            active={rangeFilter === 'today'}
                            onClick={() => setRangeFilter((r) => (r === 'today' ? 'all' : 'today'))}
                        />
                        <PulseTile
                            label="This week"
                            value={weekCount}
                            icon={<Calendar size={14} />}
                            tone="slate"
                            active={rangeFilter === '7d'}
                            onClick={() => setRangeFilter((r) => (r === '7d' ? 'all' : '7d'))}
                        />
                        <PulseTile
                            label="Rejects 30d"
                            value={rejectionsMonth}
                            icon={<XCircle size={14} />}
                            tone="danger"
                            active={actionFilter === 'rejected' && rangeFilter === '30d'}
                            onClick={() => {
                                const isActive = actionFilter === 'rejected' && rangeFilter === '30d';
                                if (isActive) {
                                    setActionFilter('all');
                                    setRangeFilter('all');
                                } else {
                                    setActionFilter('rejected');
                                    setRangeFilter('30d');
                                }
                            }}
                        />
                        <PulseTile
                            label="New accounts 30d"
                            value={newAccountsMonth}
                            icon={<UserCheck size={14} />}
                            tone="success"
                            active={actionFilter === 'approved' && entityFilter === 'user' && rangeFilter === '30d'}
                            onClick={() => {
                                const isActive = actionFilter === 'approved' && entityFilter === 'user' && rangeFilter === '30d';
                                if (isActive) {
                                    setActionFilter('all');
                                    setEntityFilter('all');
                                    setRangeFilter('all');
                                } else {
                                    setActionFilter('approved');
                                    setEntityFilter('user');
                                    setRangeFilter('30d');
                                }
                            }}
                        />
                    </div>
                </section>

                {/* ── STREAM ───────────────────────────────────────────────── */}
                <section className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-slate-400 to-slate-600" />
                            <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">Activity stream</h2>
                            <span className="text-xs text-[--color-text-muted]">{filtered.length} of {total}</span>
                            {(search || entityFilter !== 'all' || rangeFilter !== 'all' || actionFilter !== 'all') && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                                >
                                    Clear filters
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
                                    placeholder="Actor or action"
                                    className="pl-9 pr-3 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 w-[200px] transition-colors"
                                />
                            </div>
                            <div className="relative">
                                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
                                <select
                                    value={entityFilter}
                                    onChange={(e) => setEntityFilter(e.target.value as EntityKey)}
                                    className="appearance-none pl-9 pr-8 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="all">All types</option>
                                    <option value="user">Accounts</option>
                                    <option value="document">Documents</option>
                                </select>
                            </div>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
                                <select
                                    value={rangeFilter}
                                    onChange={(e) => setRangeFilter(e.target.value as RangeKey)}
                                    className="appearance-none pl-9 pr-8 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="all">All time</option>
                                    <option value="today">Today</option>
                                    <option value="7d">Last 7d</option>
                                    <option value="30d">Last 30d</option>
                                </select>
                            </div>
                            <div className="relative">
                                <select
                                    value={actionFilter}
                                    onChange={(e) => setActionFilter(e.target.value as ActionKey)}
                                    className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="all">All actions</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="uploaded">Uploaded</option>
                                    <option value="verified">Verified</option>
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={() => downloadCsv(filtered)}
                                disabled={filtered.length === 0}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-500/30 hover:bg-indigo-500/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <Download size={13} /> Export CSV
                            </button>
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[--color-border] bg-[--color-surface] p-10 text-center">
                            <FileCheck size={28} className="mx-auto text-[--color-text-muted] mb-2 opacity-60" />
                            <p className="text-sm text-[--color-text-muted]">No events match.</p>
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="mt-2 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                            >
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <motion.div variants={stagger(0.02)} initial="hidden" animate="show" className="space-y-8">
                            {grouped.map(([day, dayEntries], gi) => (
                                <Fragment key={day}>
                                    <div className="relative">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[--color-text-muted]">
                                                {day}
                                            </span>
                                            <span className="text-[10px] text-[--color-text-muted]">{dayEntries.length} event{dayEntries.length === 1 ? '' : 's'}</span>
                                            <div className="flex-1 h-px bg-gradient-to-r from-[--color-border] to-transparent" />
                                        </div>
                                        <div className="relative space-y-2">
                                            {/* Vertical rail */}
                                            <span
                                                aria-hidden
                                                className="absolute left-[12px] top-3 bottom-3 w-px bg-gradient-to-b from-indigo-500/30 via-[--color-border] to-transparent"
                                            />
                                            {dayEntries.map((e) => (
                                                <EntryRow key={e.id} entry={e} />
                                            ))}
                                        </div>
                                    </div>
                                    {gi < grouped.length - 1 && <div className="h-px" />}
                                </Fragment>
                            ))}
                        </motion.div>
                    )}
                </section>
            </div>
        </div>
    );
}
