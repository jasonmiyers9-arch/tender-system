'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FileSearch, Calendar, ShieldCheck, Building2, LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

export default function ProviderDashboardPage() {
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="Tender Provider Dashboard"
                subtitle="Manage tender issuers, review company readiness, and track provider-side activity."
                icon={<LayoutDashboard size={22} />}
                iconColor="#3B82F6"
                actions={
                    <div className="flex gap-3">
                        <Link href="/provider/profile">
                            <Button variant="ghost">Provider Profile</Button>
                        </Link>
                        <Link href="/provider/tenders/new">
                            <Button>Upload Tender</Button>
                        </Link>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <div className="flex items-center gap-3">
                        <FileSearch size={18} className="text-[--color-primary]" />
                        <div>
                            <p className="text-sm font-semibold text-[--color-text-primary]">Tender Review</p>
                            <p className="text-xs text-[--color-text-muted]">Review company submissions and readiness.</p>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div className="flex items-center gap-3">
                        <Calendar size={18} className="text-[--color-primary]" />
                        <div>
                            <p className="text-sm font-semibold text-[--color-text-primary]">Pipeline Calendar</p>
                            <p className="text-xs text-[--color-text-muted]">Track tender deadlines and upcoming milestones.</p>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div className="flex items-center gap-3">
                        <ShieldCheck size={18} className="text-[--color-primary]" />
                        <div>
                            <p className="text-sm font-semibold text-[--color-text-primary]">Portal Type</p>
                            <Badge variant="accent" size="sm">Tender Provider</Badge>
                        </div>
                    </div>
                </Card>
            </div>

            <Card>
                <div className="flex items-start gap-3">
                    <Building2 size={18} className="text-[--color-primary] mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-[--color-text-primary]">Provider portal separation is now active</p>
                        <p className="text-sm text-[--color-text-muted] mt-1">
                            This portal is separated from the company and admin experiences. Next step after the meeting is to flesh out tender creation, issuer management, and submission review workflows.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
