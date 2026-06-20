'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import { motion } from 'motion/react';
import {
    AlertCircle, Bell, CheckCircle2, ChevronDown,
    Filter, Globe, Heart, Key, RefreshCw, Shield, Sparkles, Zap,
} from 'lucide-react';
import { DownloadButton } from '@/components/ui/DownloadButton';
import { useAppStore } from '@/store/useAppStore';
import { admin } from '@/lib/api/admin';
import { fadeUp, T, stagger } from '@/lib/motion';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';

type StatusResponse = {
    frontend_url: string;
    reachable: boolean;
    status_code: number | null;
    latency_ms: number | null;
    probe_error: string | null;
    checked_at: string;
    last_heartbeat: {
        at: string | null;
        route: string | null;
        user_agent: string | null;
        build_id: string | null;
        seconds_since: number | null;
    };
    events_count: number;
};

type EventItem = {
    timestamp: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    route: string;
    stack?: string | null;
};

type LevelKey = 'all' | 'error' | 'warning' | 'info';

const LEVEL_TONE: Record<EventItem['level'], { dot: string; chip: string; text: string; label: string }> = {
    error: { dot: 'bg-red-500', chip: 'bg-red-500/10 border-red-500/30', text: 'text-red-600', label: 'Error' },
    warning: { dot: 'bg-amber-500', chip: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-600', label: 'Warning' },
    info: { dot: 'bg-indigo-500', chip: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-600', label: 'Info' },
};

function dayBucket(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86_400_000;
    const t = date.getTime();
    if (Number.isNaN(t)) return 'Unknown';
    if (t >= startOfToday) return 'Today';
    if (t >= startOfYesterday) return 'Yesterday';
    return date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
}

function timeOnly(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function classifyLatency(ms: number | null): { tone: 'success' | 'warning' | 'danger' | 'muted'; label: string } {
    if (ms === null || ms === undefined) return { tone: 'muted', label: '—' };
    if (ms < 300) return { tone: 'success', label: `${ms} ms` };
    if (ms < 1000) return { tone: 'warning', label: `${ms} ms` };
    return { tone: 'danger', label: `${ms} ms` };
}

function classifyHeartbeat(seconds: number | null): { tone: 'success' | 'warning' | 'danger' | 'muted'; label: string } {
    if (seconds === null || seconds === undefined) return { tone: 'muted', label: '—' };
    if (seconds < 30) return { tone: 'success', label: `${seconds}s` };
    if (seconds < 300) return { tone: 'warning', label: `${seconds}s` };
    return { tone: 'danger', label: `${Math.floor(seconds / 60)}m` };
}

function classifyHttp(code: number | null): { tone: 'success' | 'warning' | 'danger' | 'muted'; label: string } {
    if (code === null) return { tone: 'muted', label: '—' };
    if (code >= 200 && code < 300) return { tone: 'success', label: String(code) };
    if (code >= 400 && code < 500) return { tone: 'warning', label: String(code) };
    if (code >= 500) return { tone: 'danger', label: String(code) };
    return { tone: 'muted', label: String(code) };
}

function downloadEventsCsv(events: EventItem[]) {
    const header = ['Timestamp', 'Level', 'Message', 'Route', 'Stack'];
    const rows = events.map((e) => [e.timestamp, e.level, e.message, e.route, e.stack ?? '']);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenderguard-frontend-events-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ─── Health tile ─────────────────────────────────────────────────────────────
function HealthTile({ label, icon, value, tone, pulse }: {
    label: string;
    icon: React.ReactNode;
    value: React.ReactNode;
    tone: 'success' | 'warning' | 'danger' | 'muted';
    pulse?: boolean;
}) {
    const ringCls = {
        success: 'ring-emerald-500/30 bg-emerald-500/5',
        warning: 'ring-amber-500/30 bg-amber-500/8',
        danger: 'ring-red-500/30 bg-red-500/8',
        muted: 'ring-[--color-border] bg-[--color-bg]',
    }[tone];
    const textCls = {
        success: 'text-emerald-600',
        warning: 'text-amber-600',
        danger: 'text-red-600',
        muted: 'text-[--color-text-primary]',
    }[tone];
    const dotCls = {
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        danger: 'bg-red-500',
        muted: 'bg-slate-400',
    }[tone];
    return (
        <div className={`flex-1 px-4 py-3.5 rounded-xl ring-1 ${ringCls}`}>
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted]">{label}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
                {pulse && (
                    <motion.span
                        className={`w-2 h-2 rounded-full ${dotCls}`}
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.15, 0.85] }}
                        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                    />
                )}
                <p className={`text-2xl font-extrabold tabular-nums ${textCls}`}>{value}</p>
            </div>
        </div>
    );
}

// ─── Event row ───────────────────────────────────────────────────────────────
function EventRow({ event }: { event: EventItem }) {
    const [open, setOpen] = useState(false);
    const tone = LEVEL_TONE[event.level];
    const canExpand = Boolean(event.stack);
    return (
        <motion.div variants={fadeUp} className="relative pl-7">
            <span className={`absolute left-[7px] top-2.5 w-3 h-3 rounded-full border-2 border-[--color-surface] ${tone.dot}`} />
            <div className="rounded-xl bg-[--color-surface] border border-[--color-border] hover:border-[--color-border-strong] transition-colors p-3.5">
                <div className="flex items-start gap-3">
                    <span className="text-[11px] text-[--color-text-muted] tabular-nums font-mono w-12 mt-0.5 flex-shrink-0">
                        {timeOnly(event.timestamp)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-[--color-text-primary] break-words">{event.message}</p>
                        <p className="text-[11px] text-[--color-text-muted] mt-1 font-mono">{event.route}</p>
                        {canExpand && open && (
                            <pre className="mt-2 p-2 rounded-md bg-[--color-bg] border border-[--color-border] text-[10px] text-[--color-text-muted] overflow-x-auto whitespace-pre-wrap break-words font-mono max-h-48">
                                {event.stack}
                            </pre>
                        )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase ${tone.chip} ${tone.text} flex-shrink-0`}>
                        {tone.label}
                    </span>
                    {canExpand && (
                        <button
                            type="button"
                            onClick={() => setOpen((o) => !o)}
                            className="p-1 rounded-md text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text-primary] cursor-pointer transition-colors flex-shrink-0"
                            aria-label={open ? 'Collapse stack' : 'Expand stack'}
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
export default function AdminMonitorPage() {
    const role = useAppStore((s) => s.currentUser?.role);
    const currentUser = useAppStore((s) => s.currentUser);
    const [status, setStatus] = useState<StatusResponse | null>(null);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
    const [currentTime, setCurrentTime] = useState(() => Date.now());

    const [levelFilter, setLevelFilter] = useState<LevelKey>('all');

    const [geminiKey, setGeminiKey] = useState('');
    const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash');
    const [aiSource, setAiSource] = useState<'admin' | 'env' | 'none'>('none');
    const [maskedKey, setMaskedKey] = useState<string | null>(null);
    const [savingAi, setSavingAi] = useState(false);
    const [aiMessage, setAiMessage] = useState<string | null>(null);

    useEffect(() => {
        if (role !== 'admin') return;
        const load = async () => {
            try {
                const [sRes, eRes] = await Promise.all([
                    fetch(`/api/ops/frontend/status`, { cache: 'no-store' }),
                    fetch(`/api/ops/frontend/events?limit=50`, { cache: 'no-store' }),
                ]);
                if (!sRes.ok) throw new Error(`Status failed (${sRes.status})`);
                if (!eRes.ok) throw new Error(`Events failed (${eRes.status})`);
                const sJson = (await sRes.json()) as StatusResponse;
                const eJson = (await eRes.json()) as { items: EventItem[] };
                const ai = await admin.getAiSettings();
                setStatus(sJson);
                setEvents(eJson.items ?? []);
                setGeminiModel(ai.geminiModel || 'gemini-2.0-flash');
                setAiSource(ai.source);
                setMaskedKey(ai.geminiKeyMasked);
                setLastUpdatedAt(Date.now());
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load monitor');
            }
        };
        load();
        const timer = setInterval(load, 10000);
        return () => clearInterval(timer);
    }, [role]);

    // Re-render every second so "Updated Xs ago" stays current.
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const filteredEvents = useMemo(() => {
        return levelFilter === 'all' ? events : events.filter((e) => e.level === levelFilter);
    }, [events, levelFilter]);

    const grouped = useMemo(() => {
        const map = new Map<string, EventItem[]>();
        for (const e of filteredEvents) {
            const key = dayBucket(e.timestamp);
            const arr = map.get(key);
            if (arr) arr.push(e);
            else map.set(key, [e]);
        }
        return Array.from(map.entries());
    }, [filteredEvents]);

    if (role === undefined || role === null) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="w-8 h-8 border-2 border-[--color-primary] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (role !== 'admin') {
        return <ErrorState title="Access denied" message="Admin role required for the health board." />;
    }

    const firstName = currentUser?.name?.split(' ')[0] ?? currentUser?.email?.split('@')[0] ?? 'there';

    const reachable = status?.reachable ?? false;
    const httpInfo = classifyHttp(status?.status_code ?? null);
    const latencyInfo = classifyLatency(status?.latency_ms ?? null);
    const hbInfo = classifyHeartbeat(status?.last_heartbeat?.seconds_since ?? null);

    const errorCount = events.filter((e) => e.level === 'error').length;
    const warningCount = events.filter((e) => e.level === 'warning').length;

    const verdictTone: 'success' | 'warning' | 'danger' =
        !reachable ? 'danger' :
        (httpInfo.tone === 'danger' || latencyInfo.tone === 'danger' || hbInfo.tone === 'danger' || errorCount > 0) ? 'danger' :
        (httpInfo.tone === 'warning' || latencyInfo.tone === 'warning' || hbInfo.tone === 'warning' || warningCount > 0) ? 'warning' :
        'success';

    const verdictTitle =
        verdictTone === 'success' ? 'All systems green' :
        verdictTone === 'warning' ? 'Site degraded' :
        'Site down';

    const verdictLine =
        `Frontend ${reachable ? 'UP' : 'DOWN'} · HTTP ${httpInfo.label} · heartbeat ${hbInfo.label} · ${errorCount} error${errorCount === 1 ? '' : 's'} captured`;

    const updatedAgo = lastUpdatedAt ? Math.max(0, Math.round((currentTime - lastUpdatedAt) / 1000)) : null;

    const handleSaveAi = async () => {
        setSavingAi(true);
        setAiMessage(null);
        try {
            const updated = await admin.updateAiSettings({
                geminiApiKey: geminiKey.trim() || undefined,
                geminiModel,
            });
            setAiSource(updated.source);
            setMaskedKey(updated.geminiKeyMasked);
            setGeminiModel(updated.geminiModel || geminiModel);
            setGeminiKey('');
            setAiMessage('Saved. New uploads will use this configuration.');
        } catch (e) {
            setAiMessage(e instanceof Error ? e.message : 'Failed to save AI settings');
        } finally {
            setSavingAi(false);
        }
    };

    const heroGradient =
        verdictTone === 'success' ? 'linear-gradient(135deg, #10B981 0%, #047857 100%)' :
        verdictTone === 'warning' ? 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)' :
        'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)';

    const heroShadow =
        verdictTone === 'success' ? '0 8px 28px rgba(16,185,129,0.45)' :
        verdictTone === 'warning' ? '0 8px 28px rgba(245,158,11,0.45)' :
        '0 8px 28px rgba(239,68,68,0.45)';

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
                                    style={{ background: heroGradient, boxShadow: heroShadow }}
                                >
                                    {verdictTone === 'success' ? <Sparkles size={24} /> : <Bell size={24} />}
                                </motion.div>
                                {verdictTone !== 'success' && (
                                    <motion.span
                                        aria-hidden
                                        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${verdictTone === 'warning' ? 'bg-amber-300' : 'bg-red-300'}`}
                                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.15, 0.85] }}
                                        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                                    />
                                )}
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                                    Health board · {firstName}
                                </p>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                                    {verdictTitle}
                                </h1>
                                <p className="mt-1.5 text-sm sm:text-base text-indigo-100/85 max-w-xl">
                                    {verdictLine}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 flex-shrink-0">
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Reachable</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${reachable ? 'text-emerald-300' : 'text-red-300'}`}>
                                    {reachable ? 'UP' : 'DOWN'}
                                </p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Heartbeat</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${hbInfo.tone === 'success' ? 'text-emerald-300' : hbInfo.tone === 'warning' ? 'text-amber-300' : hbInfo.tone === 'danger' ? 'text-red-300' : 'text-white'}`}>
                                    {hbInfo.label}
                                </p>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm min-w-[88px]">
                                <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Errors</p>
                                <p className={`text-2xl font-extrabold mt-1 tabular-nums ${errorCount > 0 ? 'text-red-300' : 'text-white'}`}>
                                    {errorCount}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {/* ── LIVE STATUS ─────────────────────────────────────────── */}
                <section className="space-y-2.5">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600" />
                        <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">Live status</h2>
                        <div className="flex-1" />
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-[--color-text-muted]">
                            <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                                className="inline-block"
                            >
                                <RefreshCw size={11} />
                            </motion.span>
                            Updated {updatedAgo ?? '—'}s ago
                        </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <HealthTile
                            label="Status"
                            icon={<Globe size={14} />}
                            value={reachable ? 'UP' : 'DOWN'}
                            tone={reachable ? 'success' : 'danger'}
                            pulse
                        />
                        <HealthTile
                            label="HTTP"
                            icon={<CheckCircle2 size={14} />}
                            value={httpInfo.label}
                            tone={httpInfo.tone}
                        />
                        <HealthTile
                            label="Latency"
                            icon={<Zap size={14} />}
                            value={latencyInfo.label}
                            tone={latencyInfo.tone}
                        />
                        <HealthTile
                            label="Heartbeat age"
                            icon={<Heart size={14} />}
                            value={hbInfo.label}
                            tone={hbInfo.tone}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4 card-shadow">
                            <p className="text-[10px] uppercase tracking-widest text-[--color-text-muted] font-semibold mb-2">Probe target</p>
                            <p className="text-sm text-[--color-text-primary] font-mono break-all">{status?.frontend_url ?? '—'}</p>
                            {status?.probe_error && (
                                <p className="mt-2 text-xs text-red-600 flex items-start gap-1"><AlertCircle size={12} className="mt-0.5 flex-shrink-0" /> {status.probe_error}</p>
                            )}
                        </div>
                        <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4 card-shadow">
                            <p className="text-[10px] uppercase tracking-widest text-[--color-text-muted] font-semibold mb-2">Last heartbeat</p>
                            <p className="text-sm text-[--color-text-primary]">
                                <span className="text-[--color-text-muted]">at </span>
                                <span className="font-mono">{status?.last_heartbeat?.at ?? '—'}</span>
                            </p>
                            <p className="text-sm text-[--color-text-primary] mt-0.5">
                                <span className="text-[--color-text-muted]">route </span>
                                <span className="font-mono">{status?.last_heartbeat?.route ?? '—'}</span>
                            </p>
                        </div>
                    </div>
                </section>

                {/* ── EVENTS ──────────────────────────────────────────────── */}
                <section className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-slate-400 to-slate-600" />
                            <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">Frontend events</h2>
                            <span className="text-xs text-[--color-text-muted]">
                                {filteredEvents.length} of {events.length}
                                {errorCount > 0 && <span className="ml-2 text-red-600">· {errorCount} error{errorCount === 1 ? '' : 's'}</span>}
                                {warningCount > 0 && <span className="ml-2 text-amber-600">· {warningCount} warning{warningCount === 1 ? '' : 's'}</span>}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="relative">
                                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
                                <select
                                    value={levelFilter}
                                    onChange={(e) => setLevelFilter(e.target.value as LevelKey)}
                                    className="appearance-none pl-9 pr-8 py-2 text-sm rounded-lg bg-[--color-surface] border border-[--color-border] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="all">All levels</option>
                                    <option value="error">Errors only</option>
                                    <option value="warning">Warnings only</option>
                                    <option value="info">Info only</option>
                                </select>
                            </div>
                            <DownloadButton
                                type="button"
                                onClick={() => downloadEventsCsv(filteredEvents)}
                                disabled={filteredEvents.length === 0}
                                iconSize={13}
                                variant="outline"
                                className="text-indigo-600 border-indigo-500/30 hover:bg-indigo-500/5"
                            >
                                Export CSV
                            </DownloadButton>
                        </div>
                    </div>

                    {filteredEvents.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[--color-border] bg-[--color-surface] p-10 text-center">
                            <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                            <p className="text-sm text-[--color-text-muted]">No frontend events captured. Quiet is good.</p>
                        </div>
                    ) : (
                        <motion.div variants={stagger(0.02)} initial="hidden" animate="show" className="space-y-6">
                            {grouped.map(([day, dayEvents], gi) => (
                                <Fragment key={day}>
                                    <div className="relative">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[--color-text-muted]">{day}</span>
                                            <span className="text-[10px] text-[--color-text-muted]">{dayEvents.length} event{dayEvents.length === 1 ? '' : 's'}</span>
                                            <div className="flex-1 h-px bg-gradient-to-r from-[--color-border] to-transparent" />
                                        </div>
                                        <div className="relative space-y-2">
                                            <span
                                                aria-hidden
                                                className="absolute left-[12px] top-3 bottom-3 w-px bg-gradient-to-b from-indigo-500/30 via-[--color-border] to-transparent"
                                            />
                                            {dayEvents.map((evt, idx) => (
                                                <EventRow key={`${evt.timestamp}-${idx}`} event={evt} />
                                            ))}
                                        </div>
                                    </div>
                                    {gi < grouped.length - 1 && <div className="h-px" />}
                                </Fragment>
                            ))}
                        </motion.div>
                    )}
                </section>

                {/* ── INTEGRATIONS ────────────────────────────────────────── */}
                <section className="space-y-2.5">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600" />
                        <h2 className="text-sm font-bold text-[--color-text-primary] tracking-tight">Integrations</h2>
                        <span className="text-[10px] text-[--color-text-muted] italic">configure third-party services</span>
                    </div>

                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="show"
                        transition={{ ...T.smooth, delay: 0.1 }}
                        className="relative overflow-hidden rounded-2xl border border-[--color-border] bg-[--color-surface] p-5 card-shadow"
                    >
                        <div
                            aria-hidden
                            className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-40"
                            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)' }}
                        />
                        <div className="relative flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-600">
                                    <Key size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-[--color-text-primary]">AI summaries · Gemini</h3>
                                    <p className="text-xs text-[--color-text-muted] mt-0.5">
                                        Powers document knowledge-base summaries across the app.
                                    </p>
                                </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase ${
                                aiSource === 'admin' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' :
                                aiSource === 'env' ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' :
                                'bg-[--color-bg] border-[--color-border] text-[--color-text-muted]'
                            }`}>
                                Source: {aiSource}
                            </span>
                        </div>

                        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Gemini API key"
                                type="password"
                                placeholder={maskedKey ? `Current: ${maskedKey}` : 'AIza…'}
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                hint="Leave empty to keep current key."
                            />
                            <Input
                                label="Model"
                                placeholder="gemini-2.0-flash"
                                value={geminiModel}
                                onChange={(e) => setGeminiModel(e.target.value)}
                            />
                        </div>

                        {aiMessage && (
                            <p className={`relative mt-3 text-xs ${aiMessage.toLowerCase().includes('fail') ? 'text-red-600' : 'text-emerald-600'}`}>
                                {aiMessage}
                            </p>
                        )}

                        <div className="relative mt-4 flex justify-end">
                            <Button onClick={handleSaveAi} loading={savingAi}>Save changes</Button>
                        </div>
                    </motion.div>
                </section>
            </div>
        </div>
    );
}
