import { classNames } from '@/lib/utils/formatters';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'accent' | 'default';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
    dot?: boolean;
    className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    danger:  'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
    accent:  'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
    default: 'bg-[--color-bg] text-[--color-text-muted] border-[--color-border]',
};

const dotClasses: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger:  'bg-red-500',
    accent:  'bg-indigo-500',
    default: 'bg-[--color-text-muted]',
};

const sizeClasses: Record<BadgeSize, string> = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
};

export function Badge({
    children,
    variant = 'default',
    size = 'md',
    dot = false,
    className,
}: BadgeProps) {
    return (
        <span
            className={classNames(
                'inline-flex items-center gap-1.5 font-medium rounded-full border',
                variantClasses[variant],
                sizeClasses[size],
                className
            )}
        >
            {dot && (
                <span
                    className={classNames('inline-block w-1.5 h-1.5 rounded-full', dotClasses[variant])}
                />
            )}
            {children}
        </span>
    );
}
