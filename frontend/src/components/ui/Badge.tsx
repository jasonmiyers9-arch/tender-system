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
    success: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
    warning: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]',
    danger: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]',
    accent: 'bg-[#DBEAFE] text-[#1D4ED8] border-[#93C5FD]',
    default: 'bg-[--color-bg] text-[--color-text-muted] border-[--color-border]',
};

const dotClasses: Record<BadgeVariant, string> = {
    success: 'bg-[#16A34A]',
    warning: 'bg-[#D97706]',
    danger: 'bg-[#DC2626]',
    accent: 'bg-[#3B82F6]',
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
