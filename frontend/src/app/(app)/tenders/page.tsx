'use client';

import { useMemo, useState } from 'react';
import { useSaveTenderSearch, useTenderMatches } from '@/lib/hooks/useTenders';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate } from '@/lib/utils/formatters';
import { FileSearch, Calendar, Building2, AlertCircle, ArrowRight, CheckCircle2, FileCheck, Shield, Clock, Target, MapPin, Users, Search, Filter, BellPlus } from 'lucide-react';
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
    const [query, setQuery] = useState('');
    const [threshold, setThreshold] = useState('0');
    const [closingDate, setClosingDate] = useState('all');
    const [department, setDepartment] = useState('all');
    const [valueRange, setValueRange] = useState('all');
    const [province, setProvince] = useState('all');
    const [tenderType, setTenderType] = useState('all');
    const [briefing, setBriefing] = useState('any');
    const [saveMessage, setSaveMessage] = useState('');
    const saveSearch = useSaveTenderSearch();
    const [referenceTime] = useState(() => Date.now());

    const filteredMatches = useMemo(() => {
        const q = query.trim().toLowerCase();
        const minScore = Number(threshold) || 0;
        return (matches ?? []).filter((t) => {
            const score = t.matchScore;
            if (score < minScore) return false;
            if (q) {
                const haystack = [t.title, t.organization, t.category, t.tenderNumber, t.description, t.sourceSite, t.requiredAt]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(q)) return false;
            }

            if (department !== 'all' && (t.category ?? '').toLowerCase() !== department) return false;
            if (province !== 'all' && (t.province || t.location || '').toLowerCase() !== province) return false;
            if (tenderType !== 'all' && !(t.tenderType || '').toLowerCase().includes(tenderType)) return false;
            if (briefing === 'true' && !t.briefing?.hasBriefingSession) return false;
            if (briefing === 'compulsory' && !t.briefing?.isCompulsory) return false;

            if (closingDate !== 'all') {
                const diffDays = Math.ceil((new Date(t.deadline).getTime() - referenceTime) / 86_400_000);
                if (closingDate === '7' && diffDays > 7) return false;
                if (closingDate === '30' && diffDays > 30) return false;
                if (closingDate === '90' && diffDays > 90) return false;
            }

            if (valueRange !== 'all') {
                const numericValue = Number(String(t.value ?? '').replace(/[^0-9.]/g, ''));
                if (Number.isFinite(numericValue)) {
                    if (valueRange === 'lt-100k' && numericValue >= 100000) return false;
                    if (valueRange === '100k-500k' && (numericValue < 100000 || numericValue > 500000)) return false;
                    if (valueRange === '500k-2m' && (numericValue < 500000 || numericValue > 2000000)) return false;
                    if (valueRange === 'gt-2m' && numericValue <= 2000000) return false;
                }
            }

            return true;
        });
    }, [matches, query, threshold, closingDate, department, valueRange, province, tenderType, briefing, referenceTime]);

    const clearFilters = () => {
        setQuery('');
        setThreshold('0');
        setClosingDate('all');
        setDepartment('all');
        setValueRange('all');
        setProvince('all');
        setTenderType('all');
        setBriefing('any');
        setSaveMessage('');
    };

    const saveCurrentSearch = async () => {
        const name = window.prompt('Name this tender alert', query ? `Tenders matching “${query}”` : 'My tender search');
        if (!name?.trim()) return;
        const ranges: Record<string, { minValue?: number; maxValue?: number }> = {
            'lt-100k': { maxValue: 100000 },
            '100k-500k': { minValue: 100000, maxValue: 500000 },
            '500k-2m': { minValue: 500000, maxValue: 2000000 },
            'gt-2m': { minValue: 2000000 },
        };
        try {
            await saveSearch.mutateAsync({
                name: name.trim(),
                frequency: 'daily',
                filters: {
                    q: query.trim() || undefined,
                    category: department === 'all' ? undefined : department,
                    province: province === 'all' ? undefined : province,
                    tenderType: tenderType === 'all' ? undefined : tenderType,
                    briefing: briefing as 'any' | 'true' | 'compulsory',
                    closingWithin: closingDate === 'all' ? undefined : Number(closingDate),
                    minScore: Number(threshold) || undefined,
                    ...(ranges[valueRange] || {}),
                },
            });
            setSaveMessage('Daily tender alert saved.');
        } catch (error) {
            setSaveMessage(error instanceof Error ? error.message : 'Could not save this alert.');
        }
    };

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

    const bidReadyCount = filteredMatches.filter(t => t.isBidReady).length;
    const highMatchCount = filteredMatches.filter(t => t.matchScore >= 85).length;
    const gapsCount = filteredMatches.filter(t => t.gaps.length > 0).length;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader
                title="Tender Match Intelligence"
                subtitle={`${filteredMatches.length} opportunities scored against your company profile and tender requirements`}
                icon={<FileSearch size={22} />}
                iconColor="#D97706"
            />

            <div className="grid gap-3 rounded-2xl border border-[--color-border] bg-[--color-surface] p-4 lg:grid-cols-4">
                <div className="relative lg:col-span-2">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter by keyword, reference, department..."
                        className="w-full rounded-xl border border-[--color-border] bg-[--color-bg] py-2.5 pl-9 pr-3 text-sm text-[--color-text-primary] outline-none focus:border-teal-500"
                    />
                </div>
                <div className="relative">
                    <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
                    <select value={valueRange} onChange={(e) => setValueRange(e.target.value)} className="w-full appearance-none rounded-xl border border-[--color-border] bg-[--color-bg] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500">
                        <option value="all">All values</option>
                        <option value="lt-100k">Under 100k</option>
                        <option value="100k-500k">100k - 500k</option>
                        <option value="500k-2m">500k - 2m</option>
                        <option value="gt-2m">Above 2m</option>
                    </select>
                </div>
                <div className="relative">
                    <select value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="w-full appearance-none rounded-xl border border-[--color-border] bg-[--color-bg] py-2.5 px-3 text-sm outline-none focus:border-teal-500">
                        <option value="all">Any closing date</option>
                        <option value="7">Closing within 7 days</option>
                        <option value="30">Closing within 30 days</option>
                        <option value="90">Closing within 90 days</option>
                    </select>
                </div>
                <div className="relative">
                    <select value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-full appearance-none rounded-xl border border-[--color-border] bg-[--color-bg] py-2.5 px-3 text-sm outline-none focus:border-teal-500">
                        <option value="0">Any match score</option>
                        <option value="50">50%+</option>
                        <option value="65">65%+</option>
                        <option value="85">85%+</option>
                        <option value="100">100%</option>
                    </select>
                </div>
                <div className="relative lg:col-span-2">
                    <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full appearance-none rounded-xl border border-[--color-border] bg-[--color-bg] py-2.5 px-3 text-sm outline-none focus:border-teal-500">
                        <option value="all">All departments</option>
                        {Array.from(new Set((matches ?? []).map((t) => (t.category ?? '').toLowerCase()).filter(Boolean))).map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <select value={province} onChange={(e) => setProvince(e.target.value)} className="w-full rounded-xl border border-[--color-border] bg-[--color-bg] px-3 py-2.5 text-sm outline-none focus:border-teal-500">
                    <option value="all">All provinces</option>
                    {Array.from(new Set((matches ?? []).map((t) => t.province?.toLowerCase()).filter((value): value is string => Boolean(value)))).sort().map((value) => (
                        <option key={value} value={value}>{value}</option>
                    ))}
                </select>
                <select value={tenderType} onChange={(e) => setTenderType(e.target.value)} className="w-full rounded-xl border border-[--color-border] bg-[--color-bg] px-3 py-2.5 text-sm outline-none focus:border-teal-500">
                    <option value="all">All tender types</option>
                    <option value="request for bid">Request for bid</option>
                    <option value="rfq">RFQ</option>
                    <option value="rfp">RFP</option>
                    <option value="open">Open tender</option>
                </select>
                <select value={briefing} onChange={(e) => setBriefing(e.target.value)} className="w-full rounded-xl border border-[--color-border] bg-[--color-bg] px-3 py-2.5 text-sm outline-none focus:border-teal-500">
                    <option value="any">Any briefing status</option>
                    <option value="true">Has briefing session</option>
                    <option value="compulsory">Compulsory briefing</option>
                </select>
                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={clearFilters}>
                        Clear filters
                    </Button>
                    <Button leftIcon={<BellPlus size={14} />} onClick={saveCurrentSearch} disabled={saveSearch.isPending}>
                        Save alert
                    </Button>
                </div>
                {saveMessage && <p className="lg:col-span-4 text-xs text-[--color-text-muted]">{saveMessage}</p>}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

            {filteredMatches.length === 0 ? (
                <Card className="p-8 text-center">
                    <p className="text-sm text-[--color-text-muted]">No tenders match the current filters.</p>
                    <Button className="mt-4" variant="outline" onClick={clearFilters}>
                        Clear filters
                    </Button>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredMatches.map((t) => {
                    const matchScore = t.matchScore;
                    const readinessScore = t.readinessScore ?? t.matchScore;
                    const isBidReady = Boolean(t.isBidReady && t.readinessScore !== undefined && readinessScore >= 100 && (t.scoreBreakdown?.tenderFitBonus ?? 0) >= 10);
                    const matchLabel = matchScore >= 85 ? 'Strong Match' : matchScore >= 65 ? 'Matched' : 'Low Match';

                    return (
                        <Link key={t.id} href={`/tenders/${t.id}`} className="block group">
                            <Card className="transition-all duration-150 group-hover:scale-[1.005] group-hover:border-[--color-border-strong]" padding="none">
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <Badge variant="default" size="sm">
                                                    Ref: {t.tenderNumber || t.id}
                                                </Badge>
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
                                                variant={matchScore >= 85 ? 'success' : matchScore >= 65 ? 'warning' : 'danger'}
                                                size="md"
                                            >
                                                {matchLabel}
                                            </Badge>
                                            <span className="text-[10px] text-[--color-text-muted]">Tender Match</span>
                                            {t.readinessScore !== undefined && (
                                                <span className="text-[10px] text-[--color-text-muted]">Readiness: {readinessScore}/100</span>
                                            )}
                                            <ArrowRight
                                                size={14}
                                                className="text-[--color-text-muted] opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                                            />
                                        </div>
                                    </div>

                                    {t.gaps.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-[--color-border] flex flex-wrap items-center gap-2">
                                            <AlertCircle size={14} className="text-[--color-warning] flex-shrink-0" />
                                            <p className="text-xs text-[--color-text-muted]">
                                                {t.gaps.length} gap{t.gaps.length > 1 ? 's' : ''}:
                                            </p>
                                            {t.gaps.slice(0, 4).map((gap) => (
                                                <Badge key={gap} variant="danger" size="sm">{gap}</Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </Link>
                    );
                    })}
                </div>
            )}
        </div>
    );
}
