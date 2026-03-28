'use client';

import { use } from 'react';
import { useAdminCompanies, useAdminCompanyDocuments, useAdminDownloadDocument, useRejectDocument, useVerifyDocument } from '@/lib/hooks/useAdmin';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/badges/Badges';
import { formatDate } from '@/lib/utils/formatters';
import { ArrowLeft, Edit, FileText, CheckCircle, XCircle, Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';

export default function AdminCompanyDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = use(params);
    const companiesQuery = useAdminCompanies();
    const docsQuery = useAdminCompanyDocuments(companyId);
    const verifyDoc = useVerifyDocument();
    const rejectDoc = useRejectDocument();
    const downloadDoc = useAdminDownloadDocument();

    if (companiesQuery.isLoading || docsQuery.isLoading) return <CardSkeleton />;
    if (companiesQuery.isError || docsQuery.isError) return <ErrorState onRetry={() => { companiesQuery.refetch(); docsQuery.refetch(); }} />;

    const company = (companiesQuery.data ?? []).find((c) => c.id === companyId);
    if (!company) return <ErrorState message="Company not found" onRetry={() => companiesQuery.refetch()} />;

    const docs = docsQuery.data?.items ?? [];

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <Link href="/admin/companies" className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-primary] mb-2 leading-none">
                <ArrowLeft size={14} /> Back to Portfolio
            </Link>

            <PageHeader
                title={company.name}
                subtitle={company.registrationNumber}
                icon={<FileText size={22} />}
                iconColor="#10B981"
                actions={<Button leftIcon={<Edit size={16} />} variant="secondary">Edit Details</Button>}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1" header={<h3 className="font-semibold text-sm">Entity Details</h3>}>
                    <dl className="space-y-4 text-sm">
                        <div><dt className="text-[--color-text-muted]">VAT Number</dt><dd className="font-medium text-[--color-text-primary]">{company.vatNumber}</dd></div>
                        <div><dt className="text-[--color-text-muted]">Industry</dt><dd className="font-medium text-[--color-text-primary]">{company.industry || '—'}</dd></div>
                        <div><dt className="text-[--color-text-muted]">Incorporated</dt><dd className="font-medium text-[--color-text-primary]">{formatDate(company.incorporatedDate)}</dd></div>
                        <div className="pt-4 border-t border-[--color-border]">
                            <dt className="text-[--color-text-muted] mb-1">CIPC Verification</dt>
                            <dd>
                                <Badge variant={company.status === 'verified' ? 'success' : 'warning'} dot>
                                    {company.status.toUpperCase()}
                                </Badge>
                            </dd>
                        </div>
                    </dl>
                </Card>

                <Card className="lg:col-span-2 space-y-4" header={<h3 className="font-semibold text-sm">Managed Documents</h3>}>
                    {docs.length === 0 && (
                        <p className="text-sm text-[--color-text-muted] text-center p-8">No documents uploaded yet.</p>
                    )}
                    {docs.map((doc) => (
                        <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-[--color-border] rounded-xl bg-[--color-bg] gap-4">
                            <div>
                                <p className="text-sm font-medium text-[--color-text-primary] flex items-center gap-2">
                                    <FileText size={14} className="text-[--color-primary] opacity-50" /> {doc.name}
                                </p>
                                <p className="text-xs text-[--color-text-muted] mt-1">Expiry: {formatDate(doc.expiryDate)}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <StatusBadge status={doc.status as any} />
                                <div className="flex gap-2 border-l border-[--color-border] pl-4">
                                    <button
                                        className="p-1.5 rounded-md text-[--color-primary] hover:bg-[#DBEAFE] transition-colors"
                                        title="Download Document"
                                        onClick={() => downloadDoc.mutate({ docId: doc.id, filename: doc.name })}
                                    >
                                        <Download size={16} />
                                    </button>
                                    {doc.status === 'uploaded' && (
                                        <>
                                            <button
                                                className="p-1.5 rounded-md text-[--color-success] hover:bg-[#DCFCE7] transition-colors"
                                                title="Mark Verified"
                                                onClick={() => verifyDoc.mutate(doc.id, { onSuccess: () => docsQuery.refetch() })}
                                            >
                                                <CheckCircle size={16} />
                                            </button>
                                            <button
                                                className="p-1.5 rounded-md text-[--color-danger] hover:bg-[#FEE2E2] transition-colors"
                                                title="Reject"
                                                onClick={() => rejectDoc.mutate({ docId: doc.id, reason: 'Rejected by admin' }, { onSuccess: () => docsQuery.refetch() })}
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </Card>
            </div>
        </div>
    );
}
