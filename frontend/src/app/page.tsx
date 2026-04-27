'use client';

import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { ArrowRight, ArrowUpRight, Shield } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { ProductMock } from '@/components/landing/ProductMock';
import { LogoMarquee } from '@/components/landing/LogoMarquee';
import { StatsStrip } from '@/components/landing/StatsStrip';
import { BentoFeatures } from '@/components/landing/BentoFeatures';

const NAV = [
    { label: 'Platform', href: '#platform' },
    { label: 'Capabilities', href: '#capabilities' },
    { label: 'Compliance', href: '#compliance' },
    { label: 'Pricing', href: '/login' },
];

export default function LandingPage() {
    const { token } = useAppStore();
    const reduceMotion = useReducedMotion();
    const heroRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);
    const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.4]);
    const appHref = '/home';

    return (
        <div
            className="min-h-screen flex flex-col text-white"
            style={{
                background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #101A33 0%, #060D18 55%, #03070F 100%)',
            }}
        >
            {/* ── Top Nav ───────────────────────────────────────────────────── */}
            <motion.header
                initial={{ y: -16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl"
                style={{ background: 'rgba(6,13,24,0.7)' }}
            >
                <div className="max-w-[1240px] mx-auto flex items-center justify-between px-6 lg:px-10 h-16">
                    <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
                        <div
                            className="w-7 h-7 rounded-md flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                        >
                            <Shield size={14} color="white" />
                        </div>
                        <span className="font-bold tracking-tight text-[15px]">
                            TenderGuard<span className="text-white/50 font-normal"> / Pro</span>
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-1">
                        {NAV.map((n) => (
                            <a
                                key={n.label}
                                href={n.href}
                                className="font-mono-pro text-[11px] uppercase tracking-[0.16em] text-white/55 hover:text-white px-3 py-2 rounded-md transition-colors"
                            >
                                {n.label}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        <Link
                            href={token ? appHref : '/login'}
                            className="hidden sm:inline-flex font-mono-pro text-[11px] uppercase tracking-[0.16em] text-white/70 hover:text-white px-3 py-2 transition-colors"
                        >
                            {token ? 'Open App' : 'Sign In'}
                        </Link>
                        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                            <Link
                                href={token ? appHref : '/register'}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold text-[#060D18] bg-white hover:bg-white/90 transition-colors cursor-pointer"
                            >
                                {token ? 'Dashboard' : 'Request Access'} <ArrowRight size={13} />
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </motion.header>

            <main className="flex-1">

                {/* ── Hero ──────────────────────────────────────────────────── */}
                <section ref={heroRef} id="platform" className="relative overflow-hidden">
                    {/* Grid backdrop */}
                    <div aria-hidden className="absolute inset-0 bg-grid-dark bg-grid-mask pointer-events-none" />
                    <div aria-hidden className="absolute inset-0 bg-noise opacity-50 pointer-events-none mix-blend-overlay" />

                    {/* Aurora */}
                    {!reduceMotion && (
                        <motion.div
                            aria-hidden
                            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] rounded-full opacity-40 blur-3xl pointer-events-none"
                            style={{
                                background: 'radial-gradient(ellipse, rgba(99,102,241,0.45) 0%, rgba(124,58,237,0.25) 40%, transparent 70%)',
                            }}
                            animate={{ scale: [1, 1.05, 1], opacity: [0.35, 0.5, 0.35] }}
                            transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
                        />
                    )}

                    <motion.div
                        style={{ y: reduceMotion ? 0 : heroY, opacity: heroOpacity }}
                        className="relative max-w-[1240px] mx-auto px-6 lg:px-10 pt-20 lg:pt-28 pb-16 lg:pb-24"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                            {/* Copy */}
                            <div className="lg:col-span-6">
                                {/* Eyebrow */}
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                    className="inline-flex items-center gap-2 mb-6"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="font-mono-pro text-[10.5px] uppercase tracking-[0.22em] text-white/55">
                                        Compliance OS · ZA Edition · v1.0
                                    </span>
                                </motion.div>

                                {/* Headline — sans + serif italic mix */}
                                <motion.h1
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
                                    className="text-[44px] sm:text-[56px] lg:text-[64px] font-bold tracking-[-0.025em] leading-[1.02] text-white"
                                >
                                    Every tender.<br />
                                    Every document.{' '}
                                    <span className="font-serif-pro italic font-normal text-white/95 inline-block">
                                        Always
                                    </span>{' '}
                                    in order.
                                </motion.h1>

                                <motion.p
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.18 }}
                                    className="mt-6 text-base lg:text-[17px] text-white/55 leading-relaxed max-w-[520px]"
                                >
                                    The compliance platform South African businesses use to hold every CIPC certificate, B-BBEE affidavit, and SARS clearance — and to put the right ones in front of every public-sector bid, on time.
                                </motion.p>

                                {/* CTAs */}
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.28 }}
                                    className="mt-8 flex flex-wrap items-center gap-3"
                                >
                                    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                                        <Link
                                            href={token ? appHref : '/register'}
                                            className="group inline-flex items-center gap-2 px-5 py-3 rounded-md bg-white text-[#060D18] text-sm font-semibold cursor-pointer hover:bg-white/95 transition-colors"
                                        >
                                            {token ? 'Open Dashboard' : 'Start your vault'}
                                            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                                        </Link>
                                    </motion.div>
                                    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                                        <Link
                                            href="#capabilities"
                                            className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-white/15 text-sm font-medium text-white/85 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
                                        >
                                            See the platform <ArrowUpRight size={14} />
                                        </Link>
                                    </motion.div>
                                </motion.div>

                                {/* Mini key/value grid */}
                                <motion.dl
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.4 }}
                                    className="mt-12 grid grid-cols-3 gap-6 max-w-md"
                                >
                                    {[
                                        { k: 'POPIA', v: 'Compliant' },
                                        { k: 'ISO',   v: '27001-aligned' },
                                        { k: 'SLA',   v: '99.9% uptime' },
                                    ].map((x) => (
                                        <div key={x.k}>
                                            <dt className="font-mono-pro text-[9.5px] uppercase tracking-[0.2em] text-white/40">{x.k}</dt>
                                            <dd className="text-[13px] text-white/85 mt-1 font-medium">{x.v}</dd>
                                        </div>
                                    ))}
                                </motion.dl>
                            </div>

                            {/* Product mock */}
                            <div className="lg:col-span-6">
                                <ProductMock />
                            </div>
                        </div>
                    </motion.div>
                </section>

                {/* ── Logo marquee ─────────────────────────────────────────── */}
                <section className="relative">
                    <div className="max-w-[1240px] mx-auto px-6 lg:px-10">
                        <div className="flex items-center gap-3 mb-2 mt-4">
                            <span className="font-mono-pro text-[10px] uppercase tracking-[0.22em] text-white/35">Trusted across · ZA Public Sector</span>
                            <span className="h-px flex-1 bg-white/[0.06]" />
                        </div>
                    </div>
                    <LogoMarquee />
                </section>

                {/* ── Stats strip ──────────────────────────────────────────── */}
                <section className="relative">
                    <div className="max-w-[1240px] mx-auto px-6 lg:px-10">
                        <StatsStrip />
                    </div>
                </section>

                {/* ── Bento capabilities ───────────────────────────────────── */}
                <section id="capabilities" className="relative py-24 lg:py-32">
                    <div className="max-w-[1240px] mx-auto px-6 lg:px-10">
                        <div className="flex items-end justify-between gap-8 mb-12">
                            <div className="max-w-2xl">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="font-mono-pro text-[10px] uppercase tracking-[0.22em] text-indigo-300/70">02 — Capabilities</span>
                                    <span className="h-px w-12 bg-white/[0.1]" />
                                </div>
                                <h2 className="text-3xl lg:text-5xl font-bold tracking-[-0.02em] leading-[1.05] text-white">
                                    A control surface for{' '}
                                    <span className="font-serif-pro italic font-normal text-white/85">public-sector bid readiness.</span>
                                </h2>
                            </div>
                            <p className="hidden lg:block text-sm text-white/50 max-w-xs leading-relaxed">
                                Built around the South African compliance lifecycle — not retrofitted from a global template.
                            </p>
                        </div>

                        <BentoFeatures />
                    </div>
                </section>

                {/* ── Compliance / closing CTA ─────────────────────────────── */}
                <section id="compliance" className="relative py-24 lg:py-32 border-t border-white/[0.06]">
                    <div aria-hidden className="absolute inset-0 bg-grid-dark bg-grid-mask opacity-50 pointer-events-none" />
                    <div className="relative max-w-[1240px] mx-auto px-6 lg:px-10">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
                            <div className="lg:col-span-7">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="font-mono-pro text-[10px] uppercase tracking-[0.22em] text-indigo-300/70">03 — Get started</span>
                                    <span className="h-px w-12 bg-white/[0.1]" />
                                </div>
                                <h2 className="text-4xl lg:text-6xl font-bold tracking-[-0.025em] leading-[1.02] text-white">
                                    Stop chasing certificates.<br />
                                    <span className="font-serif-pro italic font-normal text-white/85">Start winning bids.</span>
                                </h2>
                                <p className="mt-6 text-base text-white/55 max-w-xl leading-relaxed">
                                    Provision your vault in under five minutes. No credit card. Free for the first compliance cycle.
                                </p>
                            </div>

                            <div className="lg:col-span-5 flex flex-col gap-3">
                                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                                    <Link
                                        href={token ? appHref : '/register'}
                                        className="group flex items-center justify-between px-6 py-5 rounded-lg bg-white text-[#060D18] font-semibold cursor-pointer hover:bg-white/95 transition-colors"
                                    >
                                        <span>{token ? 'Open your dashboard' : 'Provision a vault'}</span>
                                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                                    </Link>
                                </motion.div>
                                <Link
                                    href="/login"
                                    className="flex items-center justify-between px-6 py-5 rounded-lg border border-white/12 text-white/85 font-medium hover:text-white hover:border-white/25 transition-colors cursor-pointer"
                                >
                                    <span>I already have an account</span>
                                    <ArrowUpRight size={16} />
                                </Link>
                                <p className="font-mono-pro text-[10px] uppercase tracking-[0.2em] text-white/35 mt-2 text-right">
                                    POPIA · ISO 27001 aligned · SOC-2 in progress
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

            </main>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <footer className="border-t border-white/[0.06] bg-[#03070F]">
                <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-12">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                        <div className="col-span-2">
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-7 h-7 rounded-md flex items-center justify-center"
                                    style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
                                    <Shield size={14} color="white" />
                                </div>
                                <span className="font-bold text-[15px]">
                                    TenderGuard<span className="text-white/50 font-normal"> / Pro</span>
                                </span>
                            </div>
                            <p className="text-sm text-white/50 max-w-xs leading-relaxed">
                                Compliance infrastructure for South African businesses bidding into public-sector tenders.
                            </p>
                        </div>
                        {[
                            { h: 'Platform', items: ['Vault', 'Score', 'Renewals', 'Discovery'] },
                            { h: 'Company',  items: ['About', 'Pricing', 'Customers', 'Contact'] },
                            { h: 'Legal',    items: ['POPIA', 'Terms', 'Security', 'Status'] },
                        ].map((col) => (
                            <div key={col.h}>
                                <p className="font-mono-pro text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">{col.h}</p>
                                <ul className="space-y-2">
                                    {col.items.map((i) => (
                                        <li key={i}>
                                            <a className="text-[13px] text-white/70 hover:text-white transition-colors cursor-pointer">{i}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-6 border-t border-white/[0.06]">
                        <p className="font-mono-pro text-[10px] uppercase tracking-[0.2em] text-white/35">
                            © 2026 TenderGuard Pro · Johannesburg · Cape Town
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="font-mono-pro text-[10px] uppercase tracking-[0.2em] text-white/55">All systems operational</span>
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    );
}
