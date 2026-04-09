'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useVaultDocument, useVaultDocuments } from '@/lib/hooks/useVault';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { docCategoryLabel, formatDateTime } from '@/lib/utils/formatters';
import { Brain, FileText, ChevronRight } from 'lucide-react';

export default function KnowledgePage() {
    const docsQuery = useVaultDocuments();
    const docs = docsQuery.data ?? [];
    const [selectedDocId, setSelectedDocId] = useState<string>('');
    const router = useRouter();

    const selectedFallbackId = useMemo(() => docs[0]?.id ?? '', [docs]);

    useEffect(() => {
        if (!selectedDocId && selectedFallbackId) {
            setSelectedDocId(selectedFallbackId);
            return;
        }
        if (selectedDocId && docs.length > 0 && !docs.some((d) => d.id === selectedDocId)) {
            setSelectedDocId(selectedFallbackId);
        }
    }, [selectedDocId, selectedFallbackId, docs]);

    const detailQuery = useVaultDocument(selectedDocId);

    if (docsQuery.isLoading) {
        return <CardSkeleton />;
    }

    if (docsQuery.isError) {
        return <ErrorState onRetry={() => docsQuery.refetch()} />;
    }

    if (!docs.length) {
        return (
            <div className="space-y-6 max-w-6xl mx-auto">
                <PageHeader
                    title="AI Knowledge"
                    subtitle="Browse extracted intelligence from your uploaded compliance documents."
                    icon={<Brain size={22} />}
                    iconColor="#0EA5E9"
                />
                <EmptyState
                    icon={<FileText size={28} />}
                    title="No documents found"
                    description="Upload a policy or compliance PDF in the vault to generate extracted knowledge."
                    action={{ label: 'Go to Vault', onClick: () => router.push('/vault') }}
                />
            </div>
        );
    }

    const doc = detailQuery.data;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="AI Knowledge"
                subtitle="Open any document from the sidebar to view extracted text and AI summary."
                icon={<Brain size={22} />}
                iconColor="#0EA5E9"
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Card className="lg:col-span-4" header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Document Sidebar</h3>}>
                    <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                        {docs.map((item) => {
                            const isActive = item.id === selectedDocId;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedDocId(item.id)}
                                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                                        isActive
                                            ? 'border-[--color-primary] bg-[--color-primary]/10'
                                            : 'border-[--color-border] hover:bg-[--color-bg]'
                                    }`}
                                >
                                    <p className="text-sm font-medium text-[--color-text-primary] truncate">{item.name}</p>
                                    <p className="mt-1 text-xs text-[--color-text-muted]">{docCategoryLabel(item.category)}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <Badge size="sm" variant={isActive ? 'accent' : 'default'}>
                                            {item.status}
                                        </Badge>
                                        <span className="text-[11px] text-[--color-text-muted]">{item.lastUpdated}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </Card>

                <div className="lg:col-span-8 space-y-4">
                    {detailQuery.isLoading ? (
                        <CardSkeleton />
                    ) : detailQuery.isError || !doc ? (
                        <ErrorState onRetry={() => detailQuery.refetch()} />
                    ) : (
                        <>
                            <Card>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-[--color-text-primary]">{doc.name}</h3>
                                        <p className="text-xs text-[--color-text-muted] mt-1">
                                            {docCategoryLabel(doc.category)}
                                            {doc.aiSummaryUpdatedAt ? ` · Updated ${formatDateTime(doc.aiSummaryUpdatedAt)}` : ''}
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => router.push(`/vault/${doc.id}`)} rightIcon={<ChevronRight size={14} />}>
                                        Open Full Document View
                                    </Button>
                                </div>
                            </Card>

                            <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">AI Summary</h3>}>
                                {doc.aiSummary ? (
                                    <>
                                        <p className="text-sm text-[--color-text-primary] leading-relaxed whitespace-pre-wrap">{doc.aiSummary}</p>
                                        <p className="text-xs text-[--color-text-muted] mt-3">
                                            {doc.aiSummaryModel ? `Model: ${doc.aiSummaryModel}` : 'Model: Not available'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-[--color-text-muted]">
                                        No AI summary stored yet. Upload PDF with AI extraction enabled to generate this view.
                                    </p>
                                )}
                            </Card>

                            <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Extracted Knowledge Text</h3>}>
                                {doc.extractedText ? (
                                    <pre className="max-h-[50vh] overflow-auto rounded-lg border border-[--color-border] bg-[--color-bg] p-3 text-xs text-[--color-text-primary] whitespace-pre-wrap">
                                        {doc.extractedText}
                                    </pre>
                                ) : (
                                    <p className="text-sm text-[--color-text-muted]">
                                        No extracted text available for this file.
                                    </p>
                                )}
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
