'use client';

import { motion } from 'motion/react';
import { classNames } from '@/lib/utils/formatters';

interface SkeletonProps {
    className?: string;
    lines?: number;
    circle?: boolean;
}

const shimmer = 'relative overflow-hidden bg-[--color-border] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent';

export function Skeleton({ className, lines = 1, circle = false }: SkeletonProps) {
    if (lines > 1) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={classNames(
                            shimmer,
                            'rounded-md h-4',
                            i === lines - 1 ? 'w-3/4' : 'w-full',
                            className
                        )}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={classNames(
                shimmer,
                circle ? 'rounded-full' : 'rounded-md',
                className
            )}
        />
    );
}

export function CardSkeleton() {
    return (
        <div className="bg-[--color-surface] border border-[--color-border] rounded-xl p-6">
            <Skeleton className="h-5 w-1/3 mb-4" />
            <Skeleton className="h-10 w-2/3 mb-2" />
            <Skeleton lines={2} />
        </div>
    );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
    return (
        <tr className="border-b border-[--color-border]">
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                </td>
            ))}
        </tr>
    );
}

/** Centered spinner with optional message — use in route loading.tsx files */
export function PageLoader({ message }: { message?: string }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="relative">
                <div className="w-10 h-10 rounded-full border-2 border-[--color-border]" />
                <motion.div
                    className="absolute inset-0 w-10 h-10 rounded-full border-2 border-[--color-primary] border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                />
            </div>
            {message && (
                <motion.p
                    className="text-sm text-[--color-text-muted]"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                >
                    {message}
                </motion.p>
            )}
        </div>
    );
}

/** Full-page dashboard skeleton — header bar, 4 stat cards, content area */
export function PageSkeleton() {
    return (
        <motion.div
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <CardSkeleton key={i} />
                ))}
            </div>
            {/* Content area */}
            <div className="bg-[--color-surface] border border-[--color-border] rounded-xl p-6 space-y-4">
                <Skeleton className="h-5 w-40 mb-4" />
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-4 w-1/5" />
                        <Skeleton className="h-4 w-1/6" />
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
