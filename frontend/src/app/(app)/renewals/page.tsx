'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRenewals } from '@/lib/hooks/useVault';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate } from '@/lib/utils/formatters';
import { 
    RefreshCw, AlertTriangle, Clock, Calendar, FileX2, 
    CheckCircle2, Upload, FileSearch, ArrowRight, Bell,
    ChevronDown, ChevronUp
} from 'lucide-react';
import type { RenewalItem } from '@/lib/api/vault';

// Urgency config
const URGENCY_CONFIG = {
    expired: {
        label: 'Expired',
        color: '#DC2626',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        borderColor: 'border-red-200 dark:border-red-800',
        icon: FileX2,
        description: 'Document has expired - renewal required immediately',
    },
    critical: {
        label: 'Critical',
        color: '#EA580C',
        bgColor: 'bg-orange-50 dark:bg-orange-950/30',
        borderColor: 'border-orange-200 dark:border-orange-800',
        icon: AlertTriangle,
        description: 'Expiring within 7 days',
    },
    warning: {
        label: 'Warning',
        color: '#D97706',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        borderColor: 'border-amber-200 dark:border-amber-800',
        icon: Clock,
        description: 'Expiring within 30 days',
    },
    upcoming: {
        label: 'Upcoming',
        color: '#0891B2',
        bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
        borderColor: 'border-cyan-200 dark:border-cyan-800',
        icon: Calendar,
        description: 'Expiring within 90 days',
    },
} as const;

function RenewalCard({ item }: { item: RenewalItem }) {
    const [showTenders, setShowTenders] = useState(false);
    const config = URGENCY_CONFIG[item.urgency];
    const Icon = config.icon;
    
    const daysText = item.urgency === 'expired' 
        ? `${item.daysOverdue} days overdue`
        : `${item.daysRemaining} days remaining`;

    return (
        <Card className={`${config.bgColor} ${config.borderColor} border`} padding="none">
            <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                        <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${config.color}20` }}
                        >
                            <Icon size={20} style={{ color: config.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge 
                                    variant={item.urgency === 'expired' ? 'danger' : item.urgency === 'critical' ? 'warning' : 'default'}
                                    size="sm"
                                >
                                    {config.label}
                                </Badge>
                                <Badge variant="default" size="sm">{item.category.toUpperCase()}</Badge>
                            </div>
                            <h3 className="text-sm font-semibold text-[--color-text-primary] truncate">
                                {item.documentName}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-xs text-[--color-text-muted]">
                                <span className="flex items-center gap-1">
                                    <Calendar size={12} />
                                    Expires: {formatDate(item.expiryDate)}
                                </span>
                                <span style={{ color: config.color }} className="font-medium">
                                    {daysText}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={item.urgency === 'expired' ? 'danger' : item.urgency === 'critical' ? 'warning' : 'default'} size="sm">
                            {item.urgency === 'expired' ? 'Expired' : 'Expiring Soon'}
                        </Badge>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/knowledge">
                        <Button variant="outline" size="sm">
                            View renewal guide
                        </Button>
                    </Link>
                    <Link href={`/vault?docId=${item.documentId}`}>
                        <Button variant="secondary" size="sm">
                            <Upload size={14} className="mr-1" />
                            Upload new document
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            window.location.href = `mailto:ops@tenderguard.co.za?subject=${encodeURIComponent(`Managed renewal request: ${item.documentName}`)}`;
                        }}
                    >
                        Request managed renewal
                    </Button>
                </div>

                {/* Affected Tenders */}
                {item.affectedTenders.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[--color-border]">
                        <button
                            onClick={() => setShowTenders(!showTenders)}
                            className="flex items-center gap-2 text-xs text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors w-full"
                        >
                            <Bell size={12} />
                            <span>
                                Affects {item.affectedTenders.length} tender{item.affectedTenders.length > 1 ? 's' : ''}
                            </span>
                            {showTenders ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        
                        {showTenders && (
                            <div className="mt-2 space-y-1">
                                {item.affectedTenders.map((tender) => (
                                    <Link 
                                        key={tender.tenderId} 
                                        href={`/tenders/${tender.tenderId}`}
                                        className="flex items-center justify-between p-2 rounded-lg bg-[--color-surface] hover:bg-[--color-surface-raised] transition-colors group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-[--color-text-primary] truncate">
                                                {tender.title}
                                            </p>
                                            <p className="text-[10px] text-[--color-text-muted]">
                                                Deadline: {formatDate(tender.deadline)}
                                            </p>
                                        </div>
                                        <ArrowRight 
                                            size={12} 
                                            className="text-[--color-text-muted] opacity-0 group-hover:opacity-100 transition-opacity"
                                        />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}

function UrgencySection({ 
    urgency, 
    items 
}: { 
    urgency: keyof typeof URGENCY_CONFIG; 
    items: RenewalItem[];
}) {
    const config = URGENCY_CONFIG[urgency];
    const Icon = config.icon;
    
    if (items.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Icon size={16} style={{ color: config.color }} />
                <h2 className="text-sm font-semibold text-[--color-text-primary]">
                    {config.label}
                </h2>
                <Badge variant="default" size="sm">{items.length}</Badge>
                <span className="text-xs text-[--color-text-muted]">— {config.description}</span>
            </div>
            <div className="space-y-2">
                {items.map((item) => (
                    <RenewalCard key={item.documentId} item={item} />
                ))}
            </div>
        </div>
    );
}

export default function RenewalsPage() {
    const { data, isLoading, isError, refetch } = useRenewals();

    if (isLoading) {
        return (
            <div className="space-y-4 max-w-4xl mx-auto">
                <div className="h-24 rounded-2xl bg-[--color-surface] animate-pulse" />
                {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
        );
    }

    if (isError) {
        return <ErrorState onRetry={refetch} />;
    }

    const renewals = data?.renewals ?? [];
    const summary = data?.summary;

    if (renewals.length === 0) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Renewal Workflows"
                    subtitle="Auto-triggered compliance tasks"
                    icon={<RefreshCw size={22} />}
                    iconColor="#059669"
                />
                <EmptyState
                    icon={<CheckCircle2 size={28} />}
                    title="All documents are up to date"
                    description="No documents are expiring within the next 90 days. Great job maintaining compliance!"
                />
            </div>
        );
    }

    // Group by urgency
    const grouped = {
        expired: renewals.filter(r => r.urgency === 'expired'),
        critical: renewals.filter(r => r.urgency === 'critical'),
        warning: renewals.filter(r => r.urgency === 'warning'),
        upcoming: renewals.filter(r => r.urgency === 'upcoming'),
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <PageHeader
                title="Renewal Workflows"
                subtitle="Auto-triggered compliance tasks"
                icon={<RefreshCw size={22} />}
                iconColor="#D97706"
            />

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: 'Expired', value: summary?.expired ?? 0, color: '#DC2626', icon: FileX2 },
                    { label: 'Critical', value: summary?.critical ?? 0, color: '#EA580C', icon: AlertTriangle },
                    { label: 'Warning', value: summary?.warning ?? 0, color: '#D97706', icon: Clock },
                    { label: 'Upcoming', value: summary?.upcoming ?? 0, color: '#0891B2', icon: Calendar },
                    { label: 'Tenders Affected', value: summary?.totalAffectedTenders ?? 0, color: '#7C3AED', icon: FileSearch },
                ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label} padding="sm">
                            <div className="flex items-center gap-3">
                                <div 
                                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${stat.color}15` }}
                                >
                                    <Icon size={16} style={{ color: stat.color }} />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-[--color-text-primary]">{stat.value}</p>
                                    <p className="text-[10px] text-[--color-text-muted] leading-tight">{stat.label}</p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Alert Banner for Expired */}
            {(summary?.expired ?? 0) > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <FileX2 size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            {summary?.expired} document{(summary?.expired ?? 0) > 1 ? 's have' : ' has'} expired
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Expired documents will exclude affected tenders from your match score. 
                            Upload renewed documents to restore eligibility.
                        </p>
                    </div>
                    <Link href="/vault">
                        <Button variant="primary" size="sm">
                            <Upload size={14} className="mr-1" />
                            Upload Now
                        </Button>
                    </Link>
                </div>
            )}

            {/* Grouped Sections */}
            <div className="space-y-6">
                <UrgencySection urgency="expired" items={grouped.expired} />
                <UrgencySection urgency="critical" items={grouped.critical} />
                <UrgencySection urgency="warning" items={grouped.warning} />
                <UrgencySection urgency="upcoming" items={grouped.upcoming} />
            </div>

            {/* Last checked */}
            {data?.lastChecked && (
                <p className="text-xs text-[--color-text-muted] text-center">
                    Last checked: {new Date(data.lastChecked).toLocaleString()}
                </p>
            )}
        </div>
    );
}
