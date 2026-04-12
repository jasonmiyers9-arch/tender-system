'use client';

import Link from 'next/link';
import {
    Shield, FolderLock, BarChart2, FileSearch, ShieldCheck,
    ArrowRight, CheckCircle2, Building2,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

// ─── Feature cards data ──────────────────────────────────────────────────────
const FEATURES = [
    {
        icon: <FolderLock size={28} />,
        title: 'Compliance Vault',
        description:
            'Securely store all your mandatory tender documents — company registration, tax clearance, B-BBEE, and more — in one encrypted, always-ready vault.',
    },
    {
        icon: <BarChart2 size={28} />,
        title: 'Compliance Score',
        description:
            'Get a real-time compliance health score based on your uploaded documents. Know exactly where you stand before submitting any bid.',
    },
    {
        icon: <FileSearch size={28} />,
        title: 'Tender Discovery',
        description:
            'Browse and track active tenders from government and public entities. Filter by category, deadline, and eligibility to find the right opportunities.',
    },
    {
        icon: <ShieldCheck size={28} />,
        title: 'Expiry Monitoring',
        description:
            'Never miss a document renewal. Automated alerts notify you weeks before tax certificates, insurance, or licences expire.',
    },
];

const TRUST_POINTS = [
    'South African B-BBEE & CSD compliance ready',
    'Role-based access for companies and administrators',
    'Document expiry alerts and audit trails',
];

// ─── Main landing page (always renders — no auto-redirect) ───────────────────
export default function LandingPage() {
    const { token } = useAppStore();

    // All logged-in users go to /home (the in-app home page with sidebar)
    const appHref = '/home';

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>

            {/* ── Top Nav ───────────────────────────────────────────────────── */}
            <header
                className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 h-16 border-b"
                style={{ background: '#040B14', borderColor: '#14253D' }}
            >
                {/* Logo */}
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
                        <Shield size={16} color="white" />
                    </div>
                    <span className="font-bold text-white tracking-tight text-sm sm:text-base">
                        TenderGuard <span style={{ color: '#818CF8' }}>Pro</span>
                    </span>
                </div>

                {/* CTA — Home app page if logged in, Sign In if guest */}
                {token ? (
                    <Link
                        href={appHref}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
                        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                    >
                        Open App <ArrowRight size={15} />
                    </Link>
                ) : (
                    <Link
                        href="/login"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
                        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                    >
                        Sign In <ArrowRight size={15} />
                    </Link>
                )}
            </header>

            <main className="flex-1">

                {/* ── Hero ──────────────────────────────────────────────────── */}
                <section className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 sm:pt-28 sm:pb-20">
                    {/* Badge */}
                    <span
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border mb-6"
                        style={{ background: 'rgba(79,70,229,0.12)', borderColor: 'rgba(79,70,229,0.3)', color: '#818CF8' }}
                    >
                        <Building2 size={12} /> Built for South African Businesses
                    </span>

                    {/* Headline */}
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl"
                        style={{ color: 'var(--color-text-primary)' }}>
                        Tender Compliance,{' '}
                        <span style={{ background: 'linear-gradient(90deg, #4F46E5, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Simplified.
                        </span>
                    </h1>

                    {/* Subline */}
                    <p className="mt-5 text-base sm:text-lg max-w-xl leading-relaxed"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        TenderGuard Pro gives South African companies a single platform to manage compliance documents,
                        track expiry dates, monitor bid readiness, and discover government tenders — all in one place.
                    </p>

                    {/* Trust points */}
                    <ul className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-6 items-center">
                        {TRUST_POINTS.map((pt) => (
                            <li key={pt} className="flex items-center gap-1.5 text-sm font-medium"
                                style={{ color: 'var(--color-text-muted)' }}>
                                <CheckCircle2 size={15} style={{ color: '#4F46E5' }} />
                                {pt}
                            </li>
                        ))}
                    </ul>

                    {/* CTA button */}
                    <Link
                        href={token ? appHref : '/login'}
                        className="mt-10 inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', boxShadow: '0 8px 32px rgba(79,70,229,0.35)' }}
                    >
                        {token ? <>Open App <ArrowRight size={18} /></> : <>Get Started — Sign In <ArrowRight size={18} /></>}
                    </Link>
                </section>

                {/* ── Features grid ────────────────────────────────────────── */}
                <section className="px-6 sm:px-10 pb-20 max-w-6xl mx-auto w-full">
                    <h2 className="text-center text-xl sm:text-2xl font-bold mb-10"
                        style={{ color: 'var(--color-text-primary)' }}>
                        Everything you need to win tenders.
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {FEATURES.map((f) => (
                            <div
                                key={f.title}
                                className="card-shadow flex flex-col gap-4 rounded-2xl border p-6"
                                style={{
                                    background: 'var(--color-surface)',
                                    borderColor: 'var(--color-border)',
                                }}
                            >
                                {/* Icon */}
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'rgba(79,70,229,0.12)', color: '#818CF8' }}>
                                    {f.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base mb-1.5"
                                        style={{ color: 'var(--color-text-primary)' }}>
                                        {f.title}
                                    </h3>
                                    <p className="text-sm leading-relaxed"
                                        style={{ color: 'var(--color-text-muted)' }}>
                                        {f.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

            </main>

            {/* ── Footer ────────────────────────────────────────────────────── */}
            <footer
                className="border-t px-6 py-5 text-center text-xs"
                style={{ borderColor: '#14253D', background: '#040B14', color: '#4A6080' }}
            >
                © 2026 TenderGuard Pro. All rights reserved. &nbsp;·&nbsp; Built for South African compliance.
            </footer>

        </div>
    );
}
