import { classNames } from '@/lib/utils/formatters';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    header?: React.ReactNode;
    footer?: React.ReactNode;
    onClick?: () => void;
    /** If true, renders a 3px indigo-purple gradient stripe at top of card */
    accent?: boolean;
}

const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
};

export function Card({
    children,
    className,
    padding = 'md',
    header,
    footer,
    onClick,
    accent = false,
}: CardProps) {
    return (
        <div
            onClick={onClick}
            className={classNames(
                'card-shadow border rounded-2xl overflow-hidden',
                onClick ? 'cursor-pointer hover:border-[--color-border-strong] transition-all duration-200' : '',
                className
            )}
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
            {accent && (
                <div className="h-0.5 w-full flex-shrink-0" style={{ background: 'linear-gradient(90deg, #4F46E5, #7C3AED, #3B82F6)' }} />
            )}
            {header && (
                <div
                    className="px-6 py-4 border-b border-[--color-border] flex items-center justify-between rounded-t-2xl"
                    style={{ backgroundColor: 'var(--color-surface-raised)' }}
                >
                    {header}
                </div>
            )}
            <div className={paddingClasses[padding]}>{children}</div>
            {footer && (
                <div
                    className="px-6 py-4 border-t border-[--color-border] rounded-b-2xl"
                    style={{ backgroundColor: 'var(--color-surface-raised)' }}
                >
                    {footer}
                </div>
            )}
        </div>
    );
}