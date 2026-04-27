'use client';

import { motion } from 'motion/react';
import { CheckCircle2, Clock, FileText, ShieldCheck } from 'lucide-react';

const ROWS = [
    { name: 'CIPC Registration', status: 'valid', expires: '2027-04-12', score: 100 },
    { name: 'Tax Clearance Certificate', status: 'valid', expires: '2026-08-30', score: 100 },
    { name: 'B-BBEE Affidavit', status: 'expiring', expires: '2026-05-21', score: 65 },
    { name: 'Public Liability Insurance', status: 'valid', expires: '2026-12-02', score: 100 },
    { name: 'Letter of Good Standing', status: 'expired', expires: '2026-02-10', score: 0 },
];

const statusStyle: Record<string, { dot: string; text: string; label: string }> = {
    valid:    { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Valid' },
    expiring: { dot: 'bg-amber-400',   text: 'text-amber-300',   label: 'Expiring' },
    expired:  { dot: 'bg-rose-400',    text: 'text-rose-300',    label: 'Expired' },
};

export function ProductMock() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 24, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            style={{ perspective: 1400 }}
            className="relative"
        >
            {/* Glow */}
            <div
                aria-hidden
                className="absolute -inset-8 rounded-[32px] blur-3xl opacity-50"
                style={{
                    background: 'radial-gradient(circle at 30% 30%, rgba(99,102,241,0.45), transparent 60%), radial-gradient(circle at 70% 70%, rgba(124,58,237,0.35), transparent 60%)',
                }}
            />

            <div
                className="relative rounded-2xl border overflow-hidden shadow-2xl"
                style={{
                    background: 'linear-gradient(180deg, #0B1426 0%, #060D18 100%)',
                    borderColor: 'rgba(99,102,241,0.25)',
                    boxShadow: '0 30px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15) inset',
                }}
            >
                {/* Window chrome */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                    </div>
                    <span className="font-mono-pro text-[10px] tracking-wider text-white/40 uppercase">app.tenderguard.co.za / vault</span>
                    <span className="w-14" />
                </div>

                {/* Content */}
                <div className="grid grid-cols-12 gap-0">
                    {/* Mini sidebar */}
                    <div className="col-span-3 border-r border-white/[0.06] py-4 px-3 space-y-1">
                        {['Dashboard', 'Vault', 'Renewals', 'Tenders', 'Score'].map((l, i) => (
                            <div
                                key={l}
                                className={`text-[11px] px-2.5 py-1.5 rounded-md ${i === 1 ? 'text-white bg-white/[0.06] border-l-2 border-indigo-400 font-semibold' : 'text-white/45'}`}
                            >
                                {l}
                            </div>
                        ))}
                    </div>

                    {/* Main */}
                    <div className="col-span-9 p-4">
                        {/* Score header */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="font-mono-pro text-[10px] tracking-widest uppercase text-white/40">Compliance Score</p>
                                <div className="flex items-baseline gap-2 mt-0.5">
                                    <span className="text-3xl font-bold text-white tabular-nums">87</span>
                                    <span className="text-sm text-white/40">/ 100</span>
                                    <span className="text-[10px] font-semibold text-emerald-300 ml-1">+4 this week</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                                <ShieldCheck size={12} className="text-emerald-300" />
                                <span className="text-[10px] font-semibold text-emerald-300">Bid Ready</span>
                            </div>
                        </div>

                        {/* Animated progress ring style bar */}
                        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden mb-4">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: '87%' }}
                                transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.7 }}
                                className="h-full rounded-full"
                                style={{ background: 'linear-gradient(90deg, #4F46E5, #7C3AED)' }}
                            />
                        </div>

                        {/* Doc list */}
                        <div className="space-y-1.5">
                            {ROWS.map((r, i) => {
                                const s = statusStyle[r.status];
                                const Icon = r.status === 'valid' ? CheckCircle2 : r.status === 'expiring' ? Clock : FileText;
                                return (
                                    <motion.div
                                        key={r.name}
                                        initial={{ opacity: 0, x: 12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-white/[0.025] hover:bg-white/[0.05] transition-colors"
                                    >
                                        <Icon size={12} className={s.text} />
                                        <span className="flex-1 text-[11.5px] text-white/85 truncate">{r.name}</span>
                                        <div className="flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                            <span className={`text-[10px] font-medium ${s.text} w-12`}>{s.label}</span>
                                        </div>
                                        <span className="font-mono-pro text-[10px] text-white/40 tabular-nums">{r.expires}</span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
