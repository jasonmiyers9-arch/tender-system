'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { classNames } from '@/lib/utils/formatters';

type SortDirection = 'asc' | 'desc' | null;

interface Column<T> {
    key: string;
    header: string;
    sortable?: boolean;
    render: (row: T) => React.ReactNode;
    width?: string;
}

interface TableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyExtractor: (row: T) => string;
    onRowClick?: (row: T) => void;
    emptyMessage?: string;
    className?: string;
}

interface PaginationProps {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
}

export function Table<T>({
    columns,
    data,
    keyExtractor,
    onRowClick,
    emptyMessage = 'No data to display',
    className,
}: TableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<SortDirection>(null);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
            if (sortDir === 'desc') setSortKey(null);
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    return (
        <div
            className={classNames(
                'w-full overflow-x-auto rounded-2xl border border-[--color-border] card-shadow bg-[--color-surface]',
                className
            )}
        >
            <table className="w-full text-sm text-left">
                <thead className="bg-[--color-bg] border-b border-[--color-border]">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                style={{ width: col.width }}
                                className={classNames(
                                    'px-4 py-3 font-semibold text-[--color-text-primary] select-none',
                                    col.sortable ? 'cursor-pointer hover:text-[--color-primary]' : ''
                                )}
                                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                            >
                                <span className="inline-flex items-center gap-1">
                                    {col.header}
                                    {col.sortable && (
                                        <span className="flex flex-col">
                                            <ChevronUp
                                                size={10}
                                                className={
                                                    sortKey === col.key && sortDir === 'asc'
                                                        ? 'text-[--color-primary]'
                                                        : 'text-[--color-text-muted]'
                                                }
                                            />
                                            <ChevronDown
                                                size={10}
                                                className={
                                                    sortKey === col.key && sortDir === 'desc'
                                                        ? 'text-[--color-primary]'
                                                        : 'text-[--color-text-muted]'
                                                }
                                            />
                                        </span>
                                    )}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[--color-border]">
                    {data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="px-4 py-12 text-center text-[--color-text-muted]"
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row) => (
                            <tr
                                key={keyExtractor(row)}
                                onClick={() => onRowClick?.(row)}
                                className={classNames(
                                    'bg-[--color-surface] transition-colors',
                                    onRowClick
                                        ? 'cursor-pointer hover:bg-[--color-bg]'
                                        : ''
                                )}
                            >
                                {columns.map((col) => (
                                    <td key={col.key} className="px-4 py-3 text-[--color-text-primary]">
                                        {col.render(row)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between px-2 py-3 text-sm text-[--color-text-muted]">
            <span>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1 rounded-md border border-[--color-border] disabled:opacity-40 hover:bg-[--color-bg] transition-colors"
                >
                    Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                    <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        className={classNames(
                            'w-8 h-8 rounded-md text-xs font-medium transition-colors',
                            p === page
                                ? 'bg-[--color-primary] text-[--color-text-primary]'
                                : 'border border-[--color-border] hover:bg-[--color-bg] text-[--color-text-primary]'
                        )}
                    >
                        {p}
                    </button>
                ))}
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded-md border border-[--color-border] disabled:opacity-40 hover:bg-[--color-bg] transition-colors"
                >
                    Next
                </button>
            </div>
        </div>
    );
}

