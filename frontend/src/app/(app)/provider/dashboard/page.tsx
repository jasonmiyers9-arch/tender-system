'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useProviderTenders } from '@/lib/hooks/useTenders';
import { useProviderApplications } from '@/lib/hooks/useApplications';
import { formatDate, formatDateTime } from '@/lib/utils/formatters';
import {
    AlertTriangle,
    Building2,
    Calendar,
    CheckCircle2,
    ClipboardList,
    FileSearch,
    LayoutDashboard,
    Plus,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

function tenderStatusVariant(status: string) {
    if (status === 'published') return 'success';
    if (status === 'pending') return 'warning';
    if (status === 'rejected') return 'danger';
    return 'default';
}

export default function ProviderDashboardPage() {
    const tendersQuery = useProviderTenders();
    const applicationsQuery = useProviderApplications();

    const tenders = tendersQuery.data ?? [];
    const applications = applicationsQuery.data ?? [];
    const pendingApplications = applications.filter((item) => item.status === 'pending');
    const publishedTenders = tenders.filter((item) => item.status === 'published');
    const upcomingTenders = [...tenders]
        .filter((item) => item.deadline)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        .slice(0, 4);
    const recentApplications = [...applications]
        .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
        .slice(0, 5);

    if (tendersQuery.isError || applicationsQuery.isError) {
        return <ErrorState onRetry={() => { tendersQuery.refetch(); applicationsQuery.refetch(); }} />;
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="Evaluator Portal"
                subtitle="Publish tenders, review supplier applications, and track procurement deadlines."
                icon={<LayoutDashboard size={22} />}
                iconColor="#2563EB"
                actions={
                    <div className="flex flex-wrap gap-3">
                        <Link href="/provider/profile">
                            <Button variant="ghost"><Building2 size={16} className="mr-1.5" />Evaluator Profile</Button>
                        </Link>
                        <Link href="/provider/tenders/new">
                            <Button><Plus size={16} className="mr-1.5" />New Tender</Button>
                        </Link>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase text-[--color-text-muted]">Tenders</p>
                            <p className="text-2xl font-bold text-[--color-text-primary] mt-1">{tenders.length}</p>
                            <p className="text-xs text-[--color-text-muted] mt-1">{publishedTenders.length} published</p>
                        </div>
                        <FileSearch size={18} className="text-[--color-primary]" />
                    </div>
                </Card>
                <Card>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase text-[--color-text-muted]">Applications</p>
                            <p className="text-2xl font-bold text-[--color-text-primary] mt-1">{applications.length}</p>
                            <p className="text-xs text-[--color-text-muted] mt-1">submitted by suppliers</p>
                        </div>
                        <ClipboardList size={18} className="text-[--color-primary]" />
                    </div>
                </Card>
                <Card>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase text-[--color-text-muted]">Pending Review</p>
                            <p className="text-2xl font-bold text-[--color-text-primary] mt-1">{pendingApplications.length}</p>
                            <p className="text-xs text-[--color-text-muted] mt-1">awaiting decision</p>
                        </div>
                        <AlertTriangle size={18} className="text-amber-500" />
                    </div>
                </Card>
                <Card>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase text-[--color-text-muted]">Portal Type</p>
                            <p className="text-base font-semibold text-[--color-text-primary] mt-2">Evaluator</p>
                            <Badge variant="accent" size="sm" className="mt-2">Procurement</Badge>
                        </div>
                        <CheckCircle2 size={18} className="text-emerald-500" />
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card
                    header={
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-[--color-primary]" />
                                <h2 className="text-sm font-semibold text-[--color-text-primary]">Upcoming Tender Deadlines</h2>
                            </div>
                            <Link href="/provider/tenders" className="text-xs font-semibold text-[--color-primary]">View all</Link>
                        </div>
                    }
                    padding="none"
                >
                    {tendersQuery.isLoading ? (
                        <div className="p-5 text-sm text-[--color-text-muted]">Loading tenders...</div>
                    ) : upcomingTenders.length === 0 ? (
                        <div className="p-5">
                            <EmptyState title="No tenders yet" description="Create a tender to start receiving supplier applications." />
                        </div>
                    ) : (
                        <div className="divide-y divide-[--color-border]">
                            {upcomingTenders.map((tender) => (
                                <div key={tender.id} className="px-5 py-4 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-[--color-text-primary] truncate">{tender.title}</p>
                                        <p className="text-xs text-[--color-text-muted] mt-1">{tender.organization} · {formatDate(tender.deadline)}</p>
                                    </div>
                                    <Badge variant={tenderStatusVariant(tender.status ?? 'draft')} size="sm">{tender.status ?? 'draft'}</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card
                    header={
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                                <ClipboardList size={16} className="text-[--color-primary]" />
                                <h2 className="text-sm font-semibold text-[--color-text-primary]">Recent Applications</h2>
                            </div>
                            <Link href="/provider/applications" className="text-xs font-semibold text-[--color-primary]">Review queue</Link>
                        </div>
                    }
                    padding="none"
                >
                    {applicationsQuery.isLoading ? (
                        <div className="p-5 text-sm text-[--color-text-muted]">Loading applications...</div>
                    ) : recentApplications.length === 0 ? (
                        <div className="p-5">
                            <EmptyState title="No applications" description="Supplier applications will appear here once companies apply to your tenders." />
                        </div>
                    ) : (
                        <div className="divide-y divide-[--color-border]">
                            {recentApplications.map((application) => (
                                <div key={application.id} className="px-5 py-4 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-[--color-text-primary] truncate">{application.companyName}</p>
                                        <p className="text-xs text-[--color-text-muted] mt-1">{application.tenderTitle} · {formatDateTime(application.appliedAt)}</p>
                                    </div>
                                    <Badge variant={application.status === 'approved' ? 'success' : application.status === 'rejected' ? 'danger' : 'warning'} size="sm">
                                        {application.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
