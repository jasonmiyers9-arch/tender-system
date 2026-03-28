import { Card } from '@/components/ui/Card';
import { ScoreBandBadge } from '@/components/badges/Badges';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { ComplianceScore } from '@/lib/api/types';

interface ScoreCardProps {
    score: ComplianceScore;
}

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    trend?: { value: number; positive: boolean };
    variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function ScoreCard({ score }: ScoreCardProps) {
    const circumference = 2 * Math.PI * 44;
    const progress = (score.score / 100) * circumference;

    const strokeColor =
        score.band === 'tender-ready'
            ? '#16A34A'
            : score.band === 'partially-ready'
                ? '#D97706'
                : '#DC2626';

    return (
        <Card className="flex-1">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h2 className="text-base font-semibold text-[--color-text-primary]">
                        Tender Readiness Score™
                    </h2>
                    <p className="text-xs text-[--color-text-muted] mt-0.5">
                        Last calculated: {new Date(score.lastCalculated).toLocaleDateString('en-ZA')}
                    </p>
                </div>
                <ScoreBandBadge band={score.band} />
            </div>

            <div className="flex items-center gap-8">
                {/* Circular progress */}
                <div className="relative w-28 h-28 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-border)" strokeWidth="8" />
                        <circle
                            cx="50"
                            cy="50"
                            r="44"
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference - progress}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-[--color-text-primary]">{score.score}</span>
                    </div>
                </div>

                {/* Breakdown */}
                <div className="flex-1 space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-[--color-text-primary]">
                        <CheckCircle2 size={14} className="text-[--color-success]" />
                        <span>
                            {score.completedDocuments}/{score.totalDocuments} documents complete
                        </span>
                    </div>
                    {score.expiringDocuments.length > 0 && (
                        <div className="flex items-start gap-2 text-[--color-text-primary]">
                            <Clock size={14} className="text-[--color-warning] mt-0.5 flex-shrink-0" />
                            <span className="text-[--color-text-muted] text-xs">
                                {score.expiringDocuments.length} document(s) expiring soon
                            </span>
                        </div>
                    )}
                    {score.missingDocuments.length > 0 && (
                        <div className="flex items-start gap-2">
                            <AlertTriangle size={14} className="text-[--color-danger] mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-[--color-text-muted]">
                                {score.missingDocuments.length} missing document(s)
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}

const variantBg = {
    default: 'bg-[--color-surface]',
    success: 'bg-emerald-500/10 border-emerald-500/25',
    warning: 'bg-amber-500/10 border-amber-500/25',
    danger:  'bg-red-500/10 border-red-500/25',
};

const variantIcon = {
    default: 'text-[--color-primary] bg-[--color-surface-raised]',
    success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/20',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-500/20',
    danger:  'text-red-600 dark:text-red-400 bg-red-500/20',
};

export function StatCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    variant = 'default',
}: StatCardProps) {
    return (
        <div
            className={`card-shadow rounded-2xl border border-[--color-border] p-5 ${variantBg[variant]}`}
        >
            <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-[--color-text-muted]">{title}</p>
                {icon && (
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${variantIcon[variant]}`}>
                        {icon}
                    </div>
                )}
            </div>
            <p className="text-3xl font-bold text-[--color-text-primary]">{value}</p>
            {subtitle && <p className="text-xs text-[--color-text-muted] mt-1">{subtitle}</p>}
            {trend && (
                <p
                    className={`text-xs mt-2 font-medium ${trend.positive ? 'text-[--color-success]' : 'text-[--color-danger]'}`}
                >
                    {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% from last period
                </p>
            )}
        </div>
    );
}
