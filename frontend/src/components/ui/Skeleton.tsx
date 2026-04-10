import { classNames } from '@/lib/utils/formatters';

interface SkeletonProps {
    className?: string;
    lines?: number;
    circle?: boolean;
}

export function Skeleton({ className, lines = 1, circle = false }: SkeletonProps) {
    if (lines > 1) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={classNames(
                            'animate-pulse bg-[--color-border] rounded-md',
                            i === lines - 1 ? 'w-3/4' : 'w-full',
                            'h-4',
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
                'animate-pulse bg-[--color-border]',
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
                <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-[--color-primary] border-t-transparent animate-spin" />
            </div>
            {message && (
                <p className="text-sm text-[--color-text-muted] animate-pulse">{message}</p>
            )}
        </div>
    );
}

/** Full-page dashboard skeleton — header bar, 4 stat cards, content area */
export function PageSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
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
        </div>
    );
}
