'use client';

import { useAdminDashboard, useRenewalsPipeline } from '@/lib/hooks/useAdmin';
import { StatCard } from '@/components/cards/Cards';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { RenewalItem } from '@/lib/api/types';
import { Building2, FileCheck, AlertTriangle, ShieldCheck, Clock, LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';

function KanbanColumn({ title, items, color }: { title: string; items: RenewalItem[]; color: string }) {
    return (
        <div className={`flex flex-col rounded-2xl border ${color} bg-opacity-30 flex-1 min-w-[280px]`}>
            <div className={`p-4 font-semibold text-sm border-b ${color} bg-opacity-20`}>
                {title} <span className="ml-2 px-2 py-0.5 rounded-full bg-white bg-opacity-50 text-xs">{items.length}</span>
            </div>
            <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                {items.length === 0 ? (
                    <div className="text-center py-8 text-xs text-opacity-60 italic">No renewals</div>
                ) : (
                    items.map(item => (
                        <div key={item.id} className="bg-[--color-surface] border border-[--color-border] p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                            <Link href={`/admin/companies/${item.companyId}`}>
                                <h4 className="text-sm font-medium text-[--color-text-primary] truncate">{item.companyName}</h4>
                                <p className="text-xs text-[--color-text-muted] mt-1">{item.documentName}</p>
                                <div className="flex items-center justify-between mt-3">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[--color-primary]">View Entity</span>
                                    <span className={`text-xs font-medium ${item.daysUntilExpiry < 0 ? 'text-[--color-danger]' : 'text-[--color-text-muted]'}`}>
                                        {item.daysUntilExpiry < 0 ? `Expired ${Math.abs(item.daysUntilExpiry)}d ago` : `Due in ${item.daysUntilExpiry}d`}
                                    </span>
                                </div>
                            </Link>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default function AdminDashboardPage() {
    const statsQuery = useAdminDashboard();
    const pipelineQuery = useRenewalsPipeline();

    const errMsg = `${(statsQuery.error as Error | null)?.message ?? ''} ${(pipelineQuery.error as Error | null)?.message ?? ''}`;
    const isForbidden = errMsg.includes('403');
    const isAnyFetching = statsQuery.isFetching || pipelineQuery.isFetching;

    // Show skeleton while loading OR while retrying after a cached error (prevents
    // flashing "Access denied" during background refetch on navigation).
    if (statsQuery.isLoading || pipelineQuery.isLoading || ((statsQuery.isError || pipelineQuery.isError) && isAnyFetching)) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
                </div>
            </div>
        );
    }

    if (statsQuery.isError || pipelineQuery.isError) {
        if (isForbidden) {
            return (
                <ErrorState
                    title="Access denied"
                    message="Your current account does not have admin access for the Managed Service Dashboard."
                />
            );
        }
        return <ErrorState onRetry={() => { statsQuery.refetch(); pipelineQuery.refetch(); }} />;
    }

    const { totalCompanies, tenderReady, partiallyReady, highRisk, totalDocuments, pendingVerification } = statsQuery.data!;
    const pipeline = pipelineQuery.data!;

    const columns = [
        { id: 'expired', title: 'Expired', items: pipeline.filter(i => i.bucket === 'expired'), color: 'border-[#FCA5A5] bg-[#FEE2E2] text-[#B91C1C]' },
        { id: 'due-7', title: 'Due < 7 Days', items: pipeline.filter(i => i.bucket === 'due-7'), color: 'border-[#FCD34D] bg-[#FEF3C7] text-[#B45309]' },
        { id: 'due-30', title: 'Due 30 Days', items: pipeline.filter(i => i.bucket === 'due-30'), color: 'border-[#FEF08A] bg-[#FEF9C3] text-[#A16207]' },
        { id: 'due-60', title: 'Due 60 Days', items: pipeline.filter(i => i.bucket === 'due-60'), color: 'border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]' },
        { id: 'due-90', title: 'Due 90+ Days', items: pipeline.filter(i => i.bucket === 'due-90'), color: 'border-[--color-border] bg-[--color-bg] text-[--color-text-primary]' },
    ];

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto overflow-x-hidden">
            <PageHeader
                title="Managed Service Dashboard"
                subtitle="Global overview of client portfolios and compliance pipelines."
                icon={<LayoutDashboard size={22} />}
                iconColor="#4F46E5"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard title="Total Clients" value={totalCompanies} icon={<Building2 size={18} />} />
                <StatCard title="Tender Ready" value={tenderReady} icon={<ShieldCheck size={18} />} variant="success" />
                <StatCard title="Partially Ready" value={partiallyReady} icon={<AlertTriangle size={18} />} variant="warning" />
                <StatCard title="High Risk" value={highRisk} icon={<AlertTriangle size={18} />} variant="danger" />
                <StatCard title="Managed Docs" value={totalDocuments} icon={<FileCheck size={18} />} />
                <div className="bg-[#DBEAFE] border border-[#93C5FD] rounded-2xl p-5 flex flex-col justify-center card-shadow">
                    <p className="text-sm font-medium text-[#1D4ED8]">Pending Verification</p>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-3xl font-bold text-[#1E3A8A]">{pendingVerification}</span>
                        <Link href="/admin/documents"><Badge variant="accent">Review Now</Badge></Link>
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-lg font-bold text-[--color-text-primary] mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-[--color-primary]" /> Renewals Pipeline
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                    {columns.map(col => (
                        <div key={col.id} className="snap-start shrink-0">
                            <KanbanColumn title={col.title} items={col.items} color={col.color} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
