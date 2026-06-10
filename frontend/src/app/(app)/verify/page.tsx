'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Building2, MapPin, Search, ShieldCheck } from 'lucide-react';
import { useVerifySearch } from '@/lib/hooks/useVerify';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScoreBandBadge } from '@/components/badges/Badges';

const RECENT_SEARCHES_KEY = 'tenderguard-evaluator-recent-searches';

function loadRecentSearches(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 8) : [];
    } catch {
        return [];
    }
}

function saveRecentSearches(searches: string[]) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, 8)));
}

export default function VerifySearchPage() {
    const [input, setInput] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const { data: results, isLoading, isError } = useVerifySearch(submittedQuery);

    useEffect(() => {
        setRecentSearches(loadRecentSearches());
    }, []);

    const runSearch = (value: string) => {
        const nextQuery = value.trim();
        if (nextQuery.length < 2) return;
        setInput(nextQuery);
        setSubmittedQuery(nextQuery);
        const nextRecent = [nextQuery, ...recentSearches.filter((item) => item.toLowerCase() !== nextQuery.toLowerCase())].slice(0, 8);
        setRecentSearches(nextRecent);
        saveRecentSearches(nextRecent);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        runSearch(input);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <PageHeader
                title="Compliance Verification Portal"
                subtitle="Instantly verify any company's tender compliance status"
                icon={<ShieldCheck size={22} />}
                iconColor="#0F766E"
            />

            <section className="max-w-4xl mx-auto space-y-5">
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
                        <input
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            placeholder="Search by company name, registration number or CSD number..."
                            className="w-full h-14 rounded-xl border border-[--color-border] bg-[--color-surface] pl-14 pr-4 text-base font-medium text-[--color-text-primary] shadow-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
                        />
                    </div>
                    <Button
                        type="submit"
                        size="lg"
                        className="h-14 px-8 text-base rounded-xl"
                        style={{ background: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)', boxShadow: '0 4px 14px rgba(15, 118, 110, 0.25)' }}
                        leftIcon={<ShieldCheck size={19} />}
                    >
                        Verify Now
                    </Button>
                </form>

                {recentSearches.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">Recent searches</span>
                        {recentSearches.map((search) => (
                            <button
                                key={search}
                                type="button"
                                onClick={() => runSearch(search)}
                                className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100"
                            >
                                {search}
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <Card padding="lg" className="min-h-[360px]">
                {!submittedQuery ? (
                    <div className="flex min-h-[280px] items-center justify-center text-center">
                        <div>
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                                <Search size={28} />
                            </div>
                            <h2 className="text-lg font-semibold text-[--color-text-primary]">Search for a registered company</h2>
                            <p className="mt-2 text-sm text-[--color-text-muted]">Use a company name, registration number, or CSD number to start verification.</p>
                        </div>
                    </div>
                ) : isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="grid gap-4 rounded-xl border border-[--color-border] p-4 sm:grid-cols-[1.5fr_1fr_auto]">
                                <div className="space-y-2">
                                    <div className="h-5 w-48 animate-pulse rounded bg-[--color-border]" />
                                    <div className="h-3 w-64 animate-pulse rounded bg-[--color-border]" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-4 w-36 animate-pulse rounded bg-[--color-border]" />
                                    <div className="h-3 w-28 animate-pulse rounded bg-[--color-border]" />
                                </div>
                                <div className="h-8 w-24 animate-pulse rounded-full bg-[--color-border]" />
                            </div>
                        ))}
                    </div>
                ) : isError ? (
                    <EmptyState
                        icon={<ShieldCheck size={24} />}
                        title="Verification search failed"
                        description="The system could not complete this search. Please try again."
                    />
                ) : !results?.length ? (
                    <EmptyState
                        icon={<Building2 size={24} />}
                        title={`No results found for ${submittedQuery}`}
                        description={`No results found for ${submittedQuery}. The company may not be registered on TenderGuard Pro yet.`}
                        action={{
                            label: 'Invite Company',
                            onClick: () => {
                                window.location.href = `mailto:?subject=${encodeURIComponent('TenderGuard Pro invitation')}&body=${encodeURIComponent(`Please register on TenderGuard Pro so we can verify your tender compliance status. Search attempted: ${submittedQuery}`)}`;
                            },
                        }}
                    />
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-sm font-semibold text-[--color-text-secondary]">Search Results</h2>
                            <Badge variant="default" size="sm">{results.length} match{results.length === 1 ? '' : 'es'}</Badge>
                        </div>
                        <ul className="space-y-3">
                            {results.map((company) => (
                                <li key={company.id}>
                                    <Link
                                        href={`/verify/company/${company.id}`}
                                        className="group grid gap-4 rounded-xl border border-[--color-border] bg-[--color-bg] p-4 transition hover:border-teal-300 hover:bg-white sm:grid-cols-[1.5fr_1fr_auto]"
                                    >
                                        <div className="min-w-0">
                                            <h3 className="truncate text-base font-semibold text-[--color-text-primary] group-hover:text-teal-700">
                                                {company.name}
                                            </h3>
                                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[--color-text-muted]">
                                                <span>Reg No: {company.registrationNumber || 'Not captured'}</span>
                                                <span>CSD: {company.csdNumber || 'Not captured'}</span>
                                            </div>
                                        </div>
                                        <div className="min-w-0 text-xs text-[--color-text-muted]">
                                            <p className="font-semibold text-[--color-text-secondary]">{company.industry || 'Industry not captured'}</p>
                                            <p className="mt-1 inline-flex items-center gap-1">
                                                <MapPin size={13} />
                                                {company.province || 'Province not captured'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:justify-center">
                                            <ScoreBandBadge band={company.band} />
                                            <Badge variant="default" size="sm">Score: {company.score}</Badge>
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                                                Open report <ArrowRight size={13} />
                                            </span>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </Card>
        </div>
    );
}
