'use client';

import { motion } from 'motion/react';
import { FolderLock, BarChart2, FileSearch, ShieldCheck, ArrowUpRight } from 'lucide-react';

function Tile({
    children,
    className = '',
    delay = 0,
}: { children: React.ReactNode; className?: string; delay?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
            whileHover={{ y: -4, transition: { duration: 0.18 } }}
            className={`group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}
            style={{
                background:
                    'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.005) 100%)',
            }}
        >
            {/* Hover halo */}
            <div
                aria-hidden
                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                    background:
                        'radial-gradient(600px circle at var(--mx,50%) var(--my,50%), rgba(99,102,241,0.18), transparent 40%)',
                }}
            />
            {children}
        </motion.div>
    );
}

function Eyebrow({ num, label }: { num: string; label: string }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <span className="font-mono-pro text-[10px] tracking-[0.18em] uppercase text-indigo-300/70">{num}</span>
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="font-mono-pro text-[10px] tracking-[0.18em] uppercase text-white/35">{label}</span>
        </div>
    );
}

export function BentoFeatures() {
    return (
        <div className="grid grid-cols-12 gap-4 lg:gap-5">

            {/* Hero tile — Vault */}
            <Tile className="col-span-12 lg:col-span-7 p-7 lg:p-9 min-h-[340px] flex flex-col">
                <Eyebrow num="01" label="Vault" />
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                        <FolderLock size={17} className="text-indigo-300" />
                    </div>
                    <div>
                        <h3 className="text-xl lg:text-2xl font-bold text-white tracking-tight leading-tight">
                            One encrypted vault. <span className="font-serif-pro italic text-indigo-200/90">Always bid-ready.</span>
                        </h3>
                        <p className="text-sm text-white/55 mt-1.5 max-w-md leading-relaxed">
                            CIPC, SARS, B-BBEE, insurance, letters of good standing — versioned, audit-logged, and ready to attach to any tender in two clicks.
                        </p>
                    </div>
                </div>

                {/* Mock document chips */}
                <div className="mt-auto grid grid-cols-2 gap-2">
                    {[
                        { name: 'CIPC.pdf',          size: '420 KB', tone: 'emerald' },
                        { name: 'SARS-TC.pdf',       size: '212 KB', tone: 'emerald' },
                        { name: 'B-BBEE-Affidavit',  size: '180 KB', tone: 'amber'   },
                        { name: 'Insurance-PL.pdf',  size: '1.2 MB', tone: 'emerald' },
                    ].map((d) => (
                        <div key={d.name} className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${d.tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                            <span className="text-[12px] text-white/85 font-medium truncate flex-1">{d.name}</span>
                            <span className="font-mono-pro text-[10px] text-white/35">{d.size}</span>
                        </div>
                    ))}
                </div>
            </Tile>

            {/* Score tile */}
            <Tile className="col-span-12 lg:col-span-5 p-7 lg:p-9 min-h-[340px] flex flex-col" delay={0.05}>
                <Eyebrow num="02" label="Score" />
                <div className="flex items-start gap-3 mb-6">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                        <BarChart2 size={17} className="text-violet-300" />
                    </div>
                    <div>
                        <h3 className="text-xl lg:text-2xl font-bold text-white tracking-tight leading-tight">
                            Compliance score, recalculated live.
                        </h3>
                    </div>
                </div>

                {/* Mock radial */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="relative w-[180px] h-[180px]">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
                            <motion.circle
                                cx="50" cy="50" r="42"
                                stroke="url(#scoreGrad)"
                                strokeWidth="6"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 42}
                                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                                whileInView={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - 0.87) }}
                                viewport={{ once: true }}
                                transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                            />
                            <defs>
                                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#818CF8" />
                                    <stop offset="100%" stopColor="#A78BFA" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="font-serif-pro italic text-5xl text-white leading-none">87</span>
                            <span className="font-mono-pro text-[10px] uppercase tracking-widest text-white/40 mt-1">Bid Ready</span>
                        </div>
                    </div>
                </div>
            </Tile>

            {/* Discovery tile */}
            <Tile className="col-span-12 lg:col-span-5 p-7 lg:p-9 min-h-[280px] flex flex-col" delay={0.1}>
                <Eyebrow num="03" label="Discovery" />
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.22)' }}>
                        <FileSearch size={17} className="text-cyan-300" />
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold text-white tracking-tight leading-tight">
                        Tenders matched, not searched.
                    </h3>
                </div>
                <p className="text-sm text-white/55 leading-relaxed mb-4 max-w-sm">
                    Filter by category, deadline, geography, B-BBEE level. Save searches and get notified the moment a fit appears.
                </p>
                <div className="mt-auto space-y-1.5">
                    {[
                        { id: 'GP-2042', dept: 'Gauteng Health', d: '12 days' },
                        { id: 'CT-9817', dept: 'City of Cape Town', d: '5 days', hot: true },
                        { id: 'NT-0066', dept: 'National Treasury', d: '21 days' },
                    ].map((t) => (
                        <div key={t.id} className="flex items-center gap-3 rounded-md px-2.5 py-1.5 bg-white/[0.025] border border-white/[0.04]">
                            <span className="font-mono-pro text-[10px] text-white/40">{t.id}</span>
                            <span className="text-[12px] text-white/85 flex-1 truncate">{t.dept}</span>
                            <span className={`font-mono-pro text-[10px] ${t.hot ? 'text-amber-300' : 'text-white/45'}`}>
                                {t.hot && '● '}{t.d}
                            </span>
                        </div>
                    ))}
                </div>
            </Tile>

            {/* Expiry tile */}
            <Tile className="col-span-12 lg:col-span-7 p-7 lg:p-9 min-h-[280px] flex flex-col" delay={0.15}>
                <Eyebrow num="04" label="Renewals" />
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)' }}>
                        <ShieldCheck size={17} className="text-amber-300" />
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold text-white tracking-tight leading-tight">
                        Never miss an expiry. <span className="font-serif-pro italic text-amber-200/85">Ever.</span>
                    </h3>
                </div>

                {/* Mock timeline */}
                <div className="mt-auto relative">
                    <div className="h-px bg-white/[0.08] absolute inset-x-0 top-3" />
                    <div className="relative flex justify-between">
                        {[
                            { day: 'Now',  label: 'Today',     tone: 'bg-emerald-400' },
                            { day: '+14',  label: 'B-BBEE',    tone: 'bg-amber-400'   },
                            { day: '+30',  label: 'Insurance', tone: 'bg-emerald-400' },
                            { day: '+90',  label: 'Tax Cert',  tone: 'bg-emerald-400' },
                            { day: '+180', label: 'CIPC',      tone: 'bg-emerald-400' },
                        ].map((m) => (
                            <div key={m.label} className="flex flex-col items-center gap-2 min-w-0">
                                <span className={`w-2 h-2 rounded-full ${m.tone} ring-4 ring-[#060D18]`} />
                                <span className="font-mono-pro text-[10px] text-white/40 uppercase tracking-wider">{m.day}</span>
                                <span className="text-[11px] text-white/70 font-medium">{m.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="absolute top-7 right-7 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight size={16} className="text-white/40" />
                </div>
            </Tile>

        </div>
    );
}
