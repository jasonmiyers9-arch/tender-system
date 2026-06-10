'use client';

import { useTenderMatches } from '@/lib/hooks/useTenders';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate } from '@/lib/utils/formatters';
import { FileSearch, Calendar, Building2, AlertCircle, ArrowRight, CheckCircle2, FileCheck, Shield, Clock, Target, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import type { TenderReadinessScoreBreakdown } from '@/lib/api/types';

// Score dimension config
const SCORE_DIMENSIONS = [
    { key: 'documentCompleteness' as const, label: 'Docs', max: 30, icon: FileCheck, color: '#4F46E5' },
    { key: 'verificationCoverage' as const, label: 'Verified', max: 25, icon: Shield, color: '#059669' },
    { key: 'csdProfileCompleteness' as const, label: 'Profile', max: 20, icon: Building2, color: '#0891B2' },
    { key: 'complianceConsistency' as const, label: 'History', max: 15, icon: Clock, color: '#7C3AED' },
    { key: 'tenderFitBonus' as const, label: 'Fit', max: 10, icon: Target, color: '#D97706' },
];

function ScoreBreakdownMini({ breakdown }: { breakdown?: TenderReadinessScoreBreakdown }) {
    if (!breakdown) return null;
    
    return (
        <div className="flex items-center gap-1.5 mt-2">
            {SCORE_DIMENSIONS.map(({ key, label, max, color }) => {
                const value = breakdown[key] ?? 0;
                const pct = Math.round((value / max) * 100);
                return (
                    <div key={key} className="flex items-center gap-1" title={`${label}: ${value}/${max}`}>
                        <div className="w-8 h-1.5 rounded-full bg-[--color-surface-raised] overflow-hidden">
                            <div 
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                        </div>
                        <span className="text-[9px] text-[--color-text-muted]">{value}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default function TendersPage() {
    const { data: matches, isLoading, isError, refetch } = useTenderMatches();

    if (isLoading)
        return (
            <div className="space-y-4 max-w-5xl mx-auto">
                <div className="h-24 rounded-2xl bg-[--color-surface] animate-pulse" />
                {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
        );
    if (isError) return <ErrorState onRetry={refetch} />;
    if (!matches?.length)
        return (
            <div className="space-y-6 max-w-5xl mx-auto">
                <PageHeader
                    title="Tender Matches"
                    subtitle="Discover tenders that match your compliance profile"
                    icon={<FileSearch size={22} />}
                    iconColor="#D97706"
                />
                <EmptyState
                    icon={<FileSearch size={28} />}
                    title="No tender matches found"
                    description="Upload more compliance documents to unlock tender match recommendations."
                />
            </div>
        );

    const bidReadyCount = matches.filter(t => t.isBidReady).length;
    const highMatchCount = matches.filter(t => (t.readinessScore ?? t.matchScore) >= 85).length;
    const gapsCount = matches.filter(t => t.gaps.length > 0).length;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader
                title="Tender Match Intelligence"
                subtitle={`${matches.length} opportunities scored against your Tender Readiness Score™`}
                icon={<FileSearch size={22} />}
                iconColor="#D97706"
            />

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Total Matches', value: matches.length, color: '#4F46E5' },
                    { label: 'Bid Ready', value: bidReadyCount, color: '#059669', icon: CheckCircle2 },
                    { label: 'High Score (85%+)', value: highMatchCount, color: '#0891B2' },
                    { label: 'Have Gaps', value: gapsCount, color: '#D97706' },
                ].map((s) => (
                    <Card key={s.label} padding="sm">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 rounded-full" style={{ background: s.color }} />
                            <div>
                                <p className="text-xl font-bold text-[--color-text-primary]">{s.value}</p>
                                <p className="text-[10px] text-[--color-text-muted] leading-tight">{s.label}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Score breakdown legend */}
            <div className="flex items-center gap-4 px-2 py-2 bg-[--color-surface] rounded-lg text-xs">
                <span className="text-[--color-text-muted] font-medium">Readiness Dimensions:</span>
                {SCORE_DIMENSIONS.map(({ label, max, color }) => (
                    <span key={label} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[--color-text-muted]">{label} ({max}pts)</span>
                    </span>
                ))}
            </div>

            <div className="space-y-3">
                {matches.map((t) => {
                    const score = t.readinessScore ?? t.matchScore;
                    const isBidReady = t.isBidReady;
                    
                    return (
                        <Link key={t.id} href={`/tenders/${t.id}`} className="block group">
                            <Card className="transition-all duration-150 group-hover:scale-[1.005] group-hover:border-[--color-border-strong]" padding="none">
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="default" size="sm">{t.category}</Badge>
                                                {isBidReady && (
                                                    <Badge variant="success" size="sm">
                                                        <CheckCircle2 size={10} className="mr-1" />
                                                        Bid Ready
                                                    </Badge>
                                                )}
                                            </div>
                                            <h2 className="text-base font-semibold text-[--color-text-primary] group-hover:text-[--color-primary] transition-colors">
                                                {t.title}
                                            </h2>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[--color-text-muted]">
                                                <span className="flex items-center gap-1">
                                                    <Building2 size={13} /> {t.organization}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={13} /> Closing: {formatDate(t.deadline)}{t.closingTime ? ` at ${t.closingTime}` : ''}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <MapPin size={13} /> Required at: {t.requiredAt || t.location || 'Not specified'}
                                                </span>
                                                <span>{t.value}</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs text-[--color-text-muted]">
                                                <span className="flex items-center gap-1.5 rounded-md bg-[--color-surface-raised] px-2 py-1">
                                                    <Users size={12} /> Briefing: {t.briefing?.hasBriefingSession ? `${t.briefing.date || 'Date TBC'}${t.briefing.venue ? `, ${t.briefing.venue}` : ''}` : 'Not specified'}
                                                </span>
                                                <span className="rounded-md bg-[--color-surface-raised] px-2 py-1">Department: {t.organization}</span>
                                                <span className="rounded-md bg-[--color-surface-raised] px-2 py-1">Category: {t.category}</span>
                                            </div>
                                            {t.recommendationReason && (
                                                <p className="mt-2 text-xs font-medium text-[--color-text-secondary]">{t.recommendationReason}</p>
                                            )}
                                            
                                            {/* Score breakdown mini bars */}
                                            <ScoreBreakdownMini breakdown={t.scoreBreakdown} />
                                        </div>
                                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                            <Badge
                                                variant={score >= 85 ? 'success' : score >= 65 ? 'warning' : 'danger'}
                                                size="md"
                                            >
                                                {score}/100
                                            </Badge>
                                            <span className="text-[10px] text-[--color-text-muted]">Readiness Score™</span>
                                            <ArrowRight
                                                size={14}
                                                className="text-[--color-text-muted] opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                                            />
                                        </div>
                                    </div>

                                    {t.gaps.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-[--color-border] flex items-start gap-2">
                                            <AlertCircle size={14} className="text-[--color-warning] mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-[--color-text-muted]">
                                                {t.gaps.length} gap{t.gaps.length > 1 ? 's' : ''}: {t.gaps.slice(0, 3).join(', ')}{t.gaps.length > 3 ? '...' : ''}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
