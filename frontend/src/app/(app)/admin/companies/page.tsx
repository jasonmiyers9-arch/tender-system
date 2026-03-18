'use client';

import { useAdminCompanies } from '@/lib/hooks/useAdmin';
import { Table } from '@/components/ui/Table';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import type { Company } from '@/lib/api/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Building2 } from 'lucide-react';

export default function AdminCompaniesPage() {
    const { data: companies, isLoading, isError, refetch } = useAdminCompanies();
    const [search, setSearch] = useState('');
    const router = useRouter();

    const filtered = companies?.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.registrationNumber.includes(search)
    ) ?? [];

    const columns = [
        {
            key: 'name',
            header: 'Company Name',
            sortable: true,
            render: (c: Company) => <span className="font-medium text-[--color-text-primary]">{c.name}</span>
        },
        {
            key: 'reg',
            header: 'Registration No',
            render: (c: Company) => <span className="text-[--color-text-muted] tracking-wide">{c.registrationNumber}</span>
        },
        {
            key: 'industry',
            header: 'Industry',
            render: (c: Company) => <span className="text-[--color-text-muted]">{c.industry}</span>
        },
        {
            key: 'status',
            header: 'CIPC Status',
            sortable: true,
            render: (c: Company) => (
                <Badge variant={c.status === 'verified' ? 'success' : c.status === 'pending' ? 'warning' : 'danger'} dot>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </Badge>
            )
        }
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">Client Portfolio</h1>
                    <p className="text-sm text-[--color-text-muted] mt-0.5">Manage all registered entities on the platform.</p>
                </div>
                <div className="flex w-full sm:w-auto gap-3">
                    <Link href="/admin/documents" className="inline-flex">
                        <button className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-[--color-primary] text-[--color-text-primary] shadow-sm hover:bg-[--color-primary-dark] transition-all duration-150">
                            Review Uploaded Documents
                        </button>
                    </Link>
                    <div className="w-full sm:w-72">
                        <Input
                            placeholder="Search clients..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            leftIcon={<Search size={16} />}
                        />
                    </div>
                </div>
            </div>

            <Card padding="none">
                {isLoading ? (
                    <div className="p-4"><table className="w-full"><tbody>{[1, 2, 3, 4, 5].map(i => <TableRowSkeleton key={i} cols={4} />)}</tbody></table></div>
                ) : isError ? (
                    <ErrorState onRetry={refetch} />
                ) : filtered.length === 0 ? (
                    <EmptyState icon={<Building2 size={24} />} title="No clients found" description={`No match for "${search}"`} />
                ) : (
                    <Table
                        columns={columns}
                        data={filtered}
                        keyExtractor={c => c.id}
                        onRowClick={c => router.push(`/admin/companies/${c.id}`)}
                    />
                )}
            </Card>
        </div>
    );
}
