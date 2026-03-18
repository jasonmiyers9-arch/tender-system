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
