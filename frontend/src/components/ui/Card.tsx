import { classNames } from '@/lib/utils/formatters';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    header?: React.ReactNode;
    footer?: React.ReactNode;
    onClick?: () => void;
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
}: CardProps) {
    return (
        <div
            onClick={onClick}
            className={classNames(
                'bg-[--color-surface] border border-[--color-border] rounded-xl shadow-sm',
                onClick ? 'cursor-pointer hover:shadow-md transition-shadow duration-200' : '',
                className
            )}
        >
            {header && (
                <div className="px-6 py-4 border-b border-[--color-border] flex items-center justify-between">
                    {header}
                </div>
            )}
            <div className={paddingClasses[padding]}>{children}</div>
            {footer && (
                <div className="px-6 py-4 border-t border-[--color-border] bg-[--color-bg] rounded-b-xl">
                    {footer}
                </div>
            )}
        </div>
    );
}
