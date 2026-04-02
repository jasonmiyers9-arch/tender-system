'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, AlertTriangle, Calendar as CalIcon } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useTenderCalendar } from '@/lib/hooks/useTenders';
import type { TenderCalendarItem } from '@/lib/api/types';
import { tenders } from '@/lib/api/tenders';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Format a Date as YYYY-MM-DD using LOCAL time, not UTC. */
function localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function dotColor(score: number) {
    if (score >= 85) return 'bg-[#22c55e]';
    if (score >= 65) return 'bg-[#f59e0b]';
    return 'bg-[#ef4444]';
}

function DayCell({
    day,
    items,
    isToday,
    isOtherMonth,
}: {
    day: Date;
    items: TenderCalendarItem[];
    isToday: boolean;
    isOtherMonth: boolean;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div
            className={`relative min-h-[80px] p-1.5 border-b border-r border-[--color-border] ${
                isOtherMonth ? 'opacity-30' : ''
            }`}
        >
            <span
                className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    isToday
                        ? 'text-white'
                        : 'text-[--color-text-muted]'
                }`}
                style={isToday ? { background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' } : undefined}
            >
                {day.getDate()}
            </span>

            {items.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                    {items.slice(0, 3).map((item) => (
                        <span
                            key={item.id}
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(item.matchScore)}`}
                            title={item.title}
                        />
                    ))}
                    {items.length > 3 && (
                        <span className="text-[9px] text-[--color-text-muted]">+{items.length - 3}</span>
                    )}
                </div>
            )}

            {items.length > 0 && (
                <button
                    onClick={() => setOpen(!open)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label={`${items.length} tender(s) on ${day.toDateString()}`}
                />
            )}

            {open && items.length > 0 && (
                <div className="absolute z-20 top-full left-0 mt-1 w-64 rounded-2xl border border-[--color-border] bg-[--color-surface] shadow-lg p-3 space-y-2 card-shadow">
                    <button
                        className="absolute top-2 right-2 text-[--color-text-muted] hover:text-[--color-text-primary] text-xs"
                        onClick={() => setOpen(false)}
                    >
                        x
                    </button>
                    {items.map((item) => (
                        <Link
                            key={item.id}
                            href={`/tenders/${item.id.replace('tender-', '')}`}
                            onClick={() => setOpen(false)}
                            className="block hover:bg-[--color-bg] rounded-xl p-2 transition-colors"
                        >
                            <p className="text-xs font-semibold text-[--color-text-primary] leading-tight">{item.title}</p>
                            <p className="text-[10px] text-[--color-text-muted] mt-0.5">{item.organization}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <Badge
                                    variant={item.matchScore >= 85 ? 'success' : item.matchScore >= 65 ? 'warning' : 'danger'}
                                    size="sm"
                                >
                                    {item.matchScore}%
                                </Badge>
                                {item.gapsCount > 0 && (
                                    <Badge variant="warning" size="sm">
                                        <AlertTriangle size={9} className="mr-1" />{item.gapsCount} gaps
                                    </Badge>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TenderCalendarPage() {
    const query = useTenderCalendar();
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    if (query.isLoading) return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="h-24 rounded-2xl bg-[--color-surface] animate-pulse" />
            <CardSkeleton />
        </div>
    );
    if (query.isError) return <ErrorState onRetry={query.refetch} message="Unable to load tender calendar." />;

    const items = query.data ?? [];

    const byDate: Record<string, TenderCalendarItem[]> = {};
    for (const item of items) {
        (byDate[item.date] ??= []).push(item);
    }

    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = firstDay.getDay();

    const cells: Date[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
        cells.push(new Date(viewYear, viewMonth, -i));
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
        cells.push(new Date(viewYear, viewMonth, d));
    }
    const remainder = cells.length % 7;
    if (remainder > 0) {
        for (let d = 1; d <= 7 - remainder; d++) {
            cells.push(new Date(viewYear, viewMonth + 1, d));
        }
    }

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
        else setViewMonth((m) => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
        else setViewMonth((m) => m + 1);
    };

    const upcomingItems = items
        .filter((i) => i.date >= localDateStr(today))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <PageHeader
                title="Tender Calendar"
                subtitle="Visual view of all tender deadlines. Click a day to see details."
                icon={<CalIcon size={22} />}
                iconColor="#7C3AED"
                actions={
                    <Button
                        variant="ghost"
                        leftIcon={<Download size={14} />}
                        onClick={() => tenders.downloadCalendarIcs()}
                        style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                    >
                        Export ICS
                    </Button>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Calendar grid */}
                <Card className="lg:col-span-3" padding="none">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[--color-border]">
                        <button
                            onClick={prevMonth}
                            className="p-1.5 rounded-lg hover:bg-[--color-bg] text-[--color-text-muted] transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <h2 className="text-sm font-semibold text-[--color-text-primary]">
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </h2>
                        <button
                            onClick={nextMonth}
                            className="p-1.5 rounded-lg hover:bg-[--color-bg] text-[--color-text-muted] transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {/* Day-name header row */}
                    <div className="grid grid-cols-7 border-b border-[--color-border]">
                        {DAY_NAMES.map((d) => (
                            <div
                                key={d}
                                className="py-2 text-center text-[10px] font-semibold tracking-wider text-[--color-text-muted] uppercase"
                            >
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7">
                        {cells.map((cellDate, i) => {
                            const key = localDateStr(cellDate);
                            const isToday = key === localDateStr(today);
                            const isOtherMonth = cellDate.getMonth() !== viewMonth;
                            return (
                                <DayCell
                                    key={i}
                                    day={cellDate}
                                    items={byDate[key] ?? []}
                                    isToday={isToday}
                                    isOtherMonth={isOtherMonth}
                                />
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 px-5 py-3 border-t border-[--color-border]">
                        <span className="text-[10px] text-[--color-text-muted] font-medium">Match score:</span>
                        {[['>=85%', 'bg-[#22c55e]'], ['>=65%', 'bg-[#f59e0b]'], ['<65%', 'bg-[#ef4444]']].map(([label, cls]) => (
                            <span key={label} className="flex items-center gap-1 text-[10px] text-[--color-text-muted]">
                                <span className={`w-2.5 h-2.5 rounded-full ${cls}`} /> {label}
                            </span>
                        ))}
                    </div>
                </Card>

                {/* Upcoming sidebar */}
                <Card
                    accent
                    header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Upcoming Deadlines</h3>}
                    padding="none"
                >
                    {upcomingItems.length === 0 ? (
                        <p className="p-5 text-sm text-[--color-text-muted]">No upcoming deadlines</p>
                    ) : (
                        <ul className="divide-y divide-[--color-border]">
                            {upcomingItems.map((item) => (
                                <li key={item.id}>
                                    <Link
                                        href={`/tenders/${item.id.replace('tender-', '')}`}
                                        className="block px-4 py-3 hover:bg-[--color-bg] transition-colors"
                                    >
                                        <p className="text-xs font-semibold text-[--color-text-primary] leading-tight truncate">
                                            {item.title}
                                        </p>
                                        <p className="text-[10px] text-[--color-text-muted] mt-0.5 truncate">
                                            {item.organization}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <span className="text-[9px] text-[--color-text-muted]">{item.date}</span>
                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor(item.matchScore)}`} />
                                            <span className="text-[9px] text-[--color-text-muted]">{item.matchScore}%</span>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
}