'use client';

import { useScore, useScoreHistory } from '@/lib/hooks/useScore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate } from '@/lib/utils/formatters';
import {
    AlertTriangle,
    BarChart2,
    CheckCircle2,
    Clock,
    FileX2,
    RefreshCw,
    TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

// --- Score gauge (SVG arc) ---

function ScoreGauge({ score }: { score: number }) {
    const radius = 80;
    const stroke = 14;
    const normalizedRadius = radius - stroke / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const arcFraction = 0.75;
    const arcLength = circumference * arcFraction;
    const offset = arcLength - (score / 100) * arcLength;

    const color =
        score >= 85 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';

    return (
        <div className="relative flex items-center justify-center" style={{ width: 200, height: 140 }}>
            <svg width={200} height={200} style={{ position: 'absolute', top: -30 }}>
                <circle
                    cx={100} cy={100} r={normalizedRadius}
                    fill="none" stroke="var(--color-border)" strokeWidth={stroke}
                    strokeDasharray={`${arcLength} ${circumference}`}
                    strokeDashoffset={0} strokeLinecap="round"
                    transform="rotate(135 100 100)"
                />
                <circle
                    cx={100} cy={100} r={normalizedRadius}
                    fill="none" stroke={color} strokeWidth={stroke}
                    strokeDasharray={`${arcLength} ${circumference}`}
                    strokeDashoffset={offset} strokeLinecap="round"
                    transform="rotate(135 100 100)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
            </svg>
            <div className="text-center z-10">
                <p className="text-[72px] leading-none font-extrabold" style={{ color }}>{score}</p>
                <p className="text-xs text-[--color-text-muted] font-medium tracking-wide">/ 100</p>
            </div>
        </div>
    );
}

// --- History bar chart ---

function HistoryChart({ points }: { points: { date: string; score: number }[] }) {
    const maxScore = 100;
    return (
        <div className="flex items-end gap-1.5 h-24 w-full">
            {points.map((p, i) => {
                const heightPct = Math.max(4, (p.score / maxScore) * 100);
                const color =
                    p.score >= 85 ? '#22c55e'
                    : p.score >= 65 ? '#f59e0b'
                    : '#ef4444';
                const label = p.date.slice(5);
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${p.date}: ${p.score}%`}>
                        <span className="text-[9px] text-[--color-text-muted] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {p.score}%
                        </span>
                        <div
                            className="w-full rounded-t-sm transition-all duration-300"
                            style={{ height: `${heightPct}%`, background: color }}
                        />
                        <span className="text-[9px] text-[--color-text-muted] leading-none">{label}</span>
                    </div>
                );
            })}
        </div>
    );
}

// --- Category labels ---

const CATEGORY_LABELS: Record<string, string> = {
    tax: 'Tax Clearance (SARS)',
    legal: 'Legal Standing',
    financial: 'Financial Statements',
    certification: 'Certification Documents',
    bbbee: 'B-BBEE Certificate',
    registration: 'CIPC Registration',
};

const CATEGORY_DETAILS: Record<string, string> = {
    tax: 'SARS Tax Clearance / TCS Pin letter - valid within 12 months',
    legal: 'Company constitution, Memorandum of Incorporation or similar',
    financial: 'Latest audited/reviewed annual financial statements',
    certification: 'CIDB grading, ISO or industry-specific certification',
    bbbee: 'Valid B-BBEE scorecard or affidavit',
    registration: 'CIPC registration certificate',
};

// --- Main page ---

export default function ScorePage() {
    const scoreQuery = useScore();
    const historyQuery = useScoreHistory();

    const bandConfig = {
        'tender-ready': { label: 'Tender Ready', variant: 'success' as const, icon: <CheckCircle2 size={14} /> },
        'partially-ready': { label: 'Partially Ready', variant: 'warning' as const, icon: <AlertTriangle size={14} /> },
        'high-risk': { label: 'High Risk', variant: 'danger' as const, icon: <FileX2 size={14} /> },
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader
                title="Tender Readiness Score™"
                subtitle="Your compliance posture, missing documents, and improvement path"
                icon={<BarChart2 size={22} />}
                iconColor="#059669"
            />

            {/* Score + History row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Gauge */}
                <Card accent className="lg:col-span-2">
                    {scoreQuery.isLoading ? (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <Skeleton className="w-40 h-32 rounded-full" />
                            <Skeleton className="w-24 h-6" />
                        </div>
                    ) : scoreQuery.isError ? (
                        <ErrorState
                            onRetry={() => scoreQuery.refetch()}
                            message="Unable to load compliance score."
                        />
                    ) : scoreQuery.data ? (
                        <div className="flex flex-col items-center gap-3 py-2">
                            <ScoreGauge score={scoreQuery.data.score} />
                            <div className="flex items-center gap-2">
                                {(() => {
                                    const cfg = bandConfig[scoreQuery.data.band] ?? bandConfig['high-risk'];
                                    return (
                                        <Badge variant={cfg.variant} className="flex items-center gap-1 px-3 py-1">
                                            {cfg.icon}
                                            {cfg.label}
                                        </Badge>
                                    );
                                })()}
                            </div>
                            <p className="text-xs text-[--color-text-muted]">
                                {scoreQuery.data.completedDocuments} of {scoreQuery.data.totalDocuments} required categories complete
                            </p>
                            {scoreQuery.data.lastCalculated && (
                                <p className="text-[10px] text-[--color-text-muted] flex items-center gap-1">
                                    <RefreshCw size={10} /> Updated {formatDate(scoreQuery.data.lastCalculated)}
                                </p>
                            )}
                        </div>
                    ) : null}
                </Card>

                {/* History chart */}
                <Card
                    accent
                    className="lg:col-span-3"
                    header={
                        <div className="flex items-center gap-2">
                            <TrendingUp size={15} className="text-[--color-primary]" />
                            <h3 className="text-sm font-semibold text-[--color-text-primary]">Score History (30 days)</h3>
                        </div>
                    }
                >
                    {historyQuery.isLoading ? (
                        <Skeleton className="h-24 w-full" />
                    ) : historyQuery.isError ? (
                        <p className="text-sm text-[--color-text-muted]">History unavailable</p>
                    ) : historyQuery.data && historyQuery.data.length > 0 ? (
                        <HistoryChart points={historyQuery.data} />
                    ) : (
                        <div className="h-24 flex items-center justify-center text-sm text-[--color-text-muted]">
                            Not enough history yet - check back tomorrow
                        </div>
                    )}
                </Card>
            </div>

            {/* Missing documents */}
            <Card
                header={
                    <div className="flex items-center gap-2">
                        <FileX2 size={15} className="text-[--color-danger]" />
                        <h3 className="text-sm font-semibold text-[--color-text-primary]">Missing Required Documents</h3>
                        {scoreQuery.data && (
                            <Badge variant="danger" size="sm" className="ml-auto">
                                {scoreQuery.data.missingDocuments.length} missing
                            </Badge>
                        )}
                    </div>
                }
            >
                {scoreQuery.isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                    </div>
                ) : scoreQuery.isError ? null : !scoreQuery.data?.missingDocuments.length ? (
                    <div className="flex items-center gap-3 py-4 text-[--color-success]">
                        <CheckCircle2 size={20} />
                        <span className="text-sm font-medium">All required document categories are covered!</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {scoreQuery.data.missingDocuments.map((cat) => (
                            <div
                                key={cat}
                                className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5"
                            >
                                <FileX2 size={16} className="text-[--color-danger] flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-[--color-text-primary]">
                                        {CATEGORY_LABELS[cat] ?? cat}
                                    </p>
                                    <p className="text-xs text-[--color-text-muted] mt-0.5">
                                        {CATEGORY_DETAILS[cat] ?? 'Required compliance document'}
                                    </p>
                                </div>
                                <Link href="/vault">
                                    <Button size="sm" variant="outline" className="flex-shrink-0">
                                        Upload
                                    </Button>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Expiring documents */}
            {(scoreQuery.data?.expiringDocuments.length ?? 0) > 0 && (
                <Card
                    header={
                        <div className="flex items-center gap-2">
                            <Clock size={15} className="text-[--color-warning]" />
                            <h3 className="text-sm font-semibold text-[--color-text-primary]">Expiring Within 30 Days</h3>
                            <Badge variant="warning" size="sm" className="ml-auto">
                                {scoreQuery.data!.expiringDocuments.length} document(s)
                            </Badge>
                        </div>
                    }
                >
                    <ul className="divide-y divide-[--color-border] -mx-6 -mb-6">
                        {scoreQuery.data!.expiringDocuments.map((filename, i) => (
                            <li key={i} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle size={15} className="text-[--color-warning] flex-shrink-0" />
                                    <span className="text-sm text-[--color-text-primary] font-medium">{filename}</span>
                                </div>
                                <Link href="/vault">
                                    <Button size="sm" variant="outline">Renew</Button>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            {/* Required categories checklist */}
            <Card
                accent
                header={
                    <h3 className="text-sm font-semibold text-[--color-text-primary]">Required Category Checklist</h3>
                }
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                        const missing = scoreQuery.data?.missingDocuments.includes(cat) ?? false;
                        return (
                            <div
                                key={cat}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                                    missing
                                        ? 'border-[--color-border] bg-[--color-bg]'
                                        : 'border-emerald-500/20 bg-emerald-500/5'
                                }`}
                            >
                                {missing ? (
                                    <FileX2 size={16} className="text-[--color-text-muted] flex-shrink-0" />
                                ) : (
                                    <CheckCircle2 size={16} className="text-[--color-success] flex-shrink-0" />
                                )}
                                <span
                                    className={`text-sm font-medium ${
                                        missing ? 'text-[--color-text-muted]' : 'text-[--color-text-primary]'
                                    }`}
                                >
                                    {label}
                                </span>
                                {missing && (
                                    <Badge variant="danger" size="sm" className="ml-auto">Missing</Badge>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {scoreQuery.data && (
                <Card
                    header={
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={15} className="text-[--color-warning]" />
                            <h3 className="text-sm font-semibold text-[--color-text-primary]">Improvement Actions</h3>
                        </div>
                    }
                >
                    <div className="space-y-2">
                        {scoreQuery.data.missingDocuments.slice(0, 4).map((cat, index) => (
                            <div key={cat} className="flex items-center gap-3 rounded-xl border border-[--color-border] px-4 py-3">
                                <span className={`w-2.5 h-2.5 rounded-full ${index === 0 ? 'bg-red-500' : index === 1 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-[--color-text-primary]">Upload {CATEGORY_LABELS[cat] ?? cat}</p>
                                    <p className="text-xs text-[--color-text-muted]">Needed to increase your compliance coverage.</p>
                                </div>
                                <span className="text-xs font-semibold text-teal-700">+8 pts</span>
                                <Link href="/vault">
                                    <Button size="sm" variant="outline">Fix Now</Button>
                                </Link>
                            </div>
                        ))}
                        {scoreQuery.data.expiringDocuments.slice(0, 2).map((doc) => (
                            <div key={doc} className="flex items-center gap-3 rounded-xl border border-[--color-border] px-4 py-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-[--color-text-primary]">Renew {doc}</p>
                                    <p className="text-xs text-[--color-text-muted]">Expired or near-expiry items reduce your score.</p>
                                </div>
                                <span className="text-xs font-semibold text-teal-700">+5 pts</span>
                                <Link href="/vault">
                                    <Button size="sm" variant="outline">Fix Now</Button>
                                </Link>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
