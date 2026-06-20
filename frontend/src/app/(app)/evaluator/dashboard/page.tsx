'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, ArrowRight, Building2, Search, ShieldCheck } from 'lucide-react';
import { useEvaluatorCompanies, useEvaluatorActivity } from '@/lib/hooks/useVerify';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDateTime } from '@/lib/utils/formatters';

export default function EvaluatorDashboardPage() {
    const companiesQuery = useEvaluatorCompanies();
    const activityQuery = useEvaluatorActivity();
    const companies = companiesQuery.data ?? [];
    const activity = activityQuery.data ?? [];
    const tenderReady = companies.filter((company) => company.score >= 85).length;
    const highRisk = companies.filter((company) => company.score < 65).length;

    if (companiesQuery.isError) return <ErrorState onRetry={() => companiesQuery.refetch()} />;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <PageHeader
                title="Evaluator Overview"
                subtitle="Verify supplier compliance and track your verification activity."
                icon={<ShieldCheck size={22} />}
                iconColor="#5882FF"
                actions={<Link href="/verify"><Button leftIcon={<Search size={16} />}>Verify a Company</Button></Link>}
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card><Metric label="Registered Companies" value={companiesQuery.isLoading ? '—' : companies.length} icon={<Building2 size={19} />} /></Card>
                <Card><Metric label="Tender Ready" value={companiesQuery.isLoading ? '—' : tenderReady} icon={<ShieldCheck size={19} />} tone="text-emerald-500" /></Card>
                <Card><Metric label="High Risk" value={companiesQuery.isLoading ? '—' : highRisk} icon={<AlertTriangle size={19} />} tone="text-red-500" /></Card>
                <Card><Metric label="My Verification Events" value={activityQuery.isLoading ? '—' : activity.length} icon={<Activity size={19} />} tone="text-blue-500" /></Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card
                    padding="none"
                    header={<SectionHeader title="Companies requiring attention" href="/verify" label="Search companies" />}
                >
                    <div className="divide-y divide-[--color-border]">
                        {[...companies].sort((a, b) => a.score - b.score).slice(0, 5).map((company) => (
                            <Link key={company.id} href={`/verify/company/${company.id}`} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-[--color-surface-raised]">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[--color-text-primary]">{company.name}</p>
                                    <p className="mt-1 text-xs text-[--color-text-muted]">{company.registrationNumber || 'Registration not captured'} · {company.industry || 'Industry not captured'}</p>
                                </div>
                                <Badge variant={company.score >= 85 ? 'success' : company.score >= 65 ? 'warning' : 'danger'}>{company.score}</Badge>
                            </Link>
                        ))}
                        {!companiesQuery.isLoading && companies.length === 0 && <p className="px-6 py-10 text-center text-sm text-[--color-text-muted]">No companies are available.</p>}
                    </div>
                </Card>

                <Card
                    padding="none"
                    header={<SectionHeader title="Recent verification activity" href="/evaluator/activity" label="View history" />}
                >
                    <div className="divide-y divide-[--color-border]">
                        {activity.slice(0, 5).map((event) => (
                            <div key={event.id} className="px-6 py-4">
                                <p className="text-sm font-semibold capitalize text-[--color-text-primary]">{event.action}</p>
                                <p className="mt-1 text-xs text-[--color-text-muted]">{event.companyName ?? 'All companies'} · {formatDateTime(event.timestamp)}</p>
                            </div>
                        ))}
                        {!activityQuery.isLoading && activity.length === 0 && <p className="px-6 py-10 text-center text-sm text-[--color-text-muted]">Your verification activity will appear here.</p>}
                    </div>
                </Card>
            </div>
        </div>
    );
}

function Metric({ label, value, icon, tone = 'text-[--color-primary]' }: { label: string; value: number | string; icon: React.ReactNode; tone?: string }) {
    return <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">{label}</p><p className="mt-2 text-3xl font-bold text-[--color-text-primary]">{value}</p></div><span className={tone}>{icon}</span></div>;
}

function SectionHeader({ title, href, label }: { title: string; href: string; label: string }) {
    return <div className="flex w-full items-center justify-between gap-3"><h2 className="text-sm font-semibold text-[--color-text-primary]">{title}</h2><Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-[--color-primary]">{label}<ArrowRight size={13} /></Link></div>;
}
