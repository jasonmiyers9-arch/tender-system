'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
    FolderLock, BarChart2, FileSearch, ShieldCheck,
    ClipboardList, Building2, ArrowRight, Shield,
    Calendar, Bell,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useScore } from '@/lib/hooks/useScore';
import { useVaultDocuments } from '@/lib/hooks/useVault';

// ─── Quick action cards ────────────────────────────────────────────────────────
const COMPANY_ACTIONS = [
    {
        icon: <FolderLock size={22} />,
        title: 'Compliance Vault',
        description: 'Manage and upload your compliance documents.',
        href: '/vault',
        color: '#4F46E5',
    },
    {
        icon: <BarChart2 size={22} />,
        title: 'Compliance Score',
        description: 'Check your real-time bid readiness score.',
        href: '/score',
        color: '#059669',
    },
    {
        icon: <FileSearch size={22} />,
        title: 'Tender Matches',
        description: 'Browse tenders that match your profile.',
        href: '/tenders',
        color: '#D97706',
    },
    {
        icon: <Calendar size={22} />,
        title: 'Tender Calendar',
        description: 'Track upcoming tender deadlines.',
        href: '/tenders/calendar',
        color: '#7C3AED',
    },
    {
        icon: <ClipboardList size={22} />,
        title: 'My Applications',
        description: 'Track all your submitted applications.',
        href: '/applications',
        color: '#0891B2',
    },
    {
        icon: <Building2 size={22} />,
        title: 'Company Profile',
        description: 'Update your company information and details.',
        href: '/company',
        color: '#DC2626',
    },
];

const ADMIN_ACTIONS = [
    { icon: <BarChart2 size={22} />, title: 'Admin Dashboard', description: 'Platform overview and key metrics.', href: '/admin/dashboard', color: '#4F46E5' },
    { icon: <FileSearch size={22} />, title: 'Tender Oversight', description: 'Review and manage all active tenders.', href: '/admin/tenders', color: '#059669' },
    { icon: <ShieldCheck size={22} />, title: 'Document Review', description: 'Verify uploaded compliance documents.', href: '/admin/documents', color: '#D97706' },
    { icon: <Building2 size={22} />, title: 'Companies', description: 'Manage registered companies.', href: '/admin/companies', color: '#7C3AED' },
    { icon: <ClipboardList size={22} />, title: 'Audit Log', description: 'Review system activity logs.', href: '/admin/audit', color: '#0891B2' },
    { icon: <Bell size={22} />, title: 'Frontend Monitor', description: 'Monitor frontend health signals.', href: '/admin/monitor', color: '#DC2626' },
];

const PROVIDER_ACTIONS = [
    { icon: <BarChart2 size={22} />, title: 'Provider Dashboard', description: 'Overview of your tender activity.', href: '/provider/dashboard', color: '#4F46E5' },
    { icon: <FileSearch size={22} />, title: 'My Tenders', description: 'Manage all your published tenders.', href: '/provider/tenders', color: '#059669' },
    { icon: <ShieldCheck size={22} />, title: 'Tender Review', description: 'Evaluate and score applications.', href: '/verify', color: '#D97706' },
    { icon: <Calendar size={22} />, title: 'Tender Calendar', description: 'Track tender deadlines.', href: '/tenders/calendar', color: '#7C3AED' },
    { icon: <ClipboardList size={22} />, title: 'Applications', description: 'Review submitted applications.', href: '/provider/applications', color: '#0891B2' },
    { icon: <Building2 size={22} />, title: 'Provider Profile', description: 'Update your provider information.', href: '/provider/profile', color: '#DC2626' },
];

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

function getRoleLabel(role: string) {
    if (role === 'admin') return 'Administrator';
    if (role === 'evaluator') return 'Tender Provider';
    return 'Company User';
}

export default function HomePage() {
    const { currentUser } = useAppStore();
    const role = currentUser?.role ?? 'user';
    const router = useRouter();
    const scoreQuery = useScore();
    const docsQuery = useVaultDocuments();

    // Admin lands on Today (the operator inbox), not the user-style Home grid.
    useEffect(() => {
        if (role === 'admin') router.replace('/admin/dashboard');
    }, [role, router]);

    const actions =
        role === 'admin' ? ADMIN_ACTIONS
        : role === 'evaluator' ? PROVIDER_ACTIONS
        : COMPANY_ACTIONS;

    const docs = Array.isArray(docsQuery.data) ? docsQuery.data : [];

    const firstName = currentUser?.name?.split(' ')[0] ?? currentUser?.email?.split('@')[0] ?? 'there';

    // Quick stats for company users
    const docsCount = docs.length;
    const expiredCount = docs.filter(d => d.status === 'expired').length;
    const score = scoreQuery.data?.score ?? null;

    return (
        <div className="space-y-8 max-w-7xl mx-auto">

            {/* ── Welcome banner ──────────────────────────────────────────── */}
            <div
                className="relative rounded-2xl overflow-hidden p-6 sm:p-8"
                style={{
                    background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E3A5C 100%)',
                }}
            >
                {/* Background shield watermark */}
                <Shield
                    size={160}
                    className="absolute -right-6 -bottom-6 opacity-[0.06]"
                    color="white"
                />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium mb-1" style={{ color: '#A5B4FC' }}>
                            {getGreeting()} · {getRoleLabel(role)}
                        </p>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            Welcome back, {firstName}
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#C7D2FE' }}>
                            {role === 'admin'
                                ? 'Manage the TenderGuard Pro platform from here.'
                                : role === 'evaluator'
                                ? 'Review applications and manage your published tenders.'
                                : 'Your compliance hub — manage documents, track scores, and discover tenders.'}
                        </p>
                    </div>

                    {/* Quick stats pill — company users only */}
                    {role === 'user' && (scoreQuery.isLoading || docsQuery.isLoading) && (
                        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20 flex-shrink-0 animate-pulse">
                            <div className="text-center space-y-1.5">
                                <div className="h-7 w-10 rounded bg-white/20 mx-auto" />
                                <div className="h-3 w-20 rounded bg-white/10" />
                            </div>
                            <div className="w-px h-10 bg-white/20" />
                            <div className="text-center space-y-1.5">
                                <div className="h-7 w-8 rounded bg-white/20 mx-auto" />
                                <div className="h-3 w-16 rounded bg-white/10" />
                            </div>
                        </div>
                    )}
                    {role === 'user' && !scoreQuery.isLoading && score !== null && (
                        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20 flex-shrink-0">
                            <div className="text-center">
                                <p className="text-2xl font-extrabold text-white">{score}%</p>
                                <p className="text-xs font-medium" style={{ color: '#C7D2FE' }}>Compliance Score</p>
                            </div>
                            <div className="w-px h-10 bg-white/20" />
                            <div className="text-center">
                                <p className="text-2xl font-extrabold text-white">{docsCount}</p>
                                <p className="text-xs font-medium" style={{ color: '#C7D2FE' }}>Documents</p>
                            </div>
                            {expiredCount > 0 && (
                                <>
                                    <div className="w-px h-10 bg-white/20" />
                                    <div className="text-center">
                                        <p className="text-2xl font-extrabold" style={{ color: '#FCA5A5' }}>{expiredCount}</p>
                                        <p className="text-xs font-medium" style={{ color: '#C7D2FE' }}>Expiring</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Quick actions grid ──────────────────────────────────────── */}
            <div>
                <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    Quick Access
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {actions.map((action) => (
                        <Link
                            key={action.href}
                            href={action.href}
                            className="group card-shadow flex items-start gap-4 rounded-2xl border p-5 transition-all duration-150 hover:scale-[1.01] hover:border-opacity-70"
                            style={{
                                background: 'var(--color-surface)',
                                borderColor: 'var(--color-border)',
                                textDecoration: 'none',
                            }}
                        >
                            {/* Icon */}
                            <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-105"
                                style={{ background: `${action.color}18`, color: action.color }}
                            >
                                {action.icon}
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                    {action.title}
                                </p>
                                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                                    {action.description}
                                </p>
                            </div>

                            {/* Arrow */}
                            <ArrowRight
                                size={15}
                                className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: action.color }}
                            />
                        </Link>
                    ))}
                </div>
            </div>

            {/* ── Platform info strip ─────────────────────────────────────── */}
            <div
                className="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                >
                    <Shield size={18} color="white" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        TenderGuard Pro Platform
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        South African B-BBEE & CSD compliance · Document expiry monitoring · Tender discovery & bid management
                    </p>
                </div>
                <Link
                    href={role === 'admin' ? '/admin/dashboard' : role === 'evaluator' ? '/provider/dashboard' : '/dashboard'}
                    className="flex items-center gap-1.5 text-xs font-semibold flex-shrink-0"
                    style={{ color: '#6366F1' }}
                >
                    Go to Dashboard <ArrowRight size={13} />
                </Link>
            </div>

        </div>
    );
}
