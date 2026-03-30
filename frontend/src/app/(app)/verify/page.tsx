'use client';

import { useState } from 'react';
import { useVerifySearch } from '@/lib/hooks/useVerify';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ScoreBandBadge } from '@/components/badges/Badges';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search, Building2, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';

export default function VerifySearchPage() {
    const [query, setQuery] = useState('');
    const { data: results, isLoading } = useVerifySearch(query);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <PageHeader
                title="TenderGuard Evaluator Portal"
                subtitle="Search and verify company compliance records in real-time. Enter a registered entity name or CIPC registration number."
                icon={<ShieldCheck size={22} />}
                iconColor="#4F46E5"
            />

            <Card padding="lg" className="max-w-2xl mx-auto">
                <div className="relative">
                    <Input
                        placeholder="Search by company name or registration number..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="text-lg py-4 pl-12 shadow-sm rounded-xl"
                        leftIcon={<Search size={20} className="text-[--color-text-muted]" />}
                    />
                </div>

                <div className="mt-6">
                    {query.trim().length <= 1 ? (
                        <div className="text-center py-10 text-[--color-text-muted]">
                            <Search size={24} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm">Start typing to search for companies...</p>
                        </div>
                    ) : isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex gap-4 items-center p-3 rounded-xl border border-[--color-border]">
                                    <div className="flex-1 space-y-2"><TableRowSkeleton cols={1} /></div>
                                </div>
                            ))}
                        </div>
                    ) : !results?.length ? (
                        <EmptyState
                            icon={<Building2 size={24} />}
                            title="No companies found"
                            description={`No exact matches found for "${query}"`}
                        />
                    ) : (
                        <ul className="space-y-3">
                            {results.map((company) => (
                                <li key={company.id}>
                                    <Link
                                        href={`/verify/company/${company.id}`}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[--color-border] bg-[--color-bg] hover:bg-white transition-colors group"
                                    >
                                        <div>
                                            <h3 className="text-base font-semibold text-[--color-text-primary] group-hover:text-[--color-primary] transition-colors">
                                                {company.name}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1.5 text-xs text-[--color-text-muted]">
                                                <span>Reg: {company.registrationNumber}</span>
                                                <span>•</span>
                                                <span>Updated: {new Date(company.lastUpdated).toLocaleDateString('en-ZA')}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                                            <ScoreBandBadge band={company.band} />
                                            <Badge variant="default" size="sm">Score: {company.score}</Badge>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Card>
        </div>
    );
}

