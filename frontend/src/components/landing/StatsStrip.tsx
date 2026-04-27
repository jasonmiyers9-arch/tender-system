'use client';

import { motion } from 'motion/react';

const STATS = [
    { value: '14', suffix: 'days', label: 'Avg time to bid-ready', sub: 'down from 6 weeks' },
    { value: '9', suffix: 'doc types', label: 'Mandatory artefacts tracked', sub: 'CIPC · SARS · B-BBEE · CSD' },
    { value: '99.9', suffix: '%', label: 'Vault uptime SLA', sub: 'Audited & encrypted' },
    { value: '0', suffix: '', label: 'Missed renewals to date', sub: 'Across pilot cohort' },
];

export function StatsStrip() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/[0.06] border-y border-white/[0.06]">
            {STATS.map((s, i) => (
                <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    className="px-6 py-8 lg:px-8 lg:py-10"
                >
                    <div className="flex items-baseline gap-1.5 mb-2">
                        <span className="font-serif-pro italic text-5xl lg:text-6xl text-white tracking-tight leading-none">
                            {s.value}
                        </span>
                        {s.suffix && (
                            <span className="font-mono-pro text-[11px] uppercase tracking-widest text-white/40 mb-1">
                                {s.suffix}
                            </span>
                        )}
                    </div>
                    <p className="text-sm font-medium text-white/85 leading-snug">{s.label}</p>
                    <p className="font-mono-pro text-[10px] uppercase tracking-wider text-white/35 mt-1">{s.sub}</p>
                </motion.div>
            ))}
        </div>
    );
}
