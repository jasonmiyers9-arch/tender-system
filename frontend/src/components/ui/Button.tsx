'use client';

import { forwardRef } from 'react';
import { classNames } from '@/lib/utils/formatters';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
    primary: 'text-white font-semibold shadow-sm',
    secondary: 'text-white font-semibold shadow-sm',
    ghost: 'bg-transparent hover:bg-[--color-bg] text-[--color-text-primary] border border-[--color-border]',
    danger: 'text-white font-semibold shadow-sm',
    success: 'text-white font-semibold shadow-sm',
    outline: 'bg-transparent border border-[--color-primary] text-[--color-primary] hover:bg-[--color-primary] hover:text-white',
};

const variantStyles: Partial<Record<Variant, React.CSSProperties>> = {
    primary: {
        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
    },
    secondary: {
        background: 'linear-gradient(135deg, #0891B2 0%, #0284C7 100%)',
        boxShadow: '0 4px 14px rgba(8, 145, 178, 0.3)',
    },
    danger: {
        background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
        boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
    },
    success: {
        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)',
    },
};

const sizeClasses: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-4 py-2 text-sm rounded-xl gap-2',
    lg: 'px-6 py-2.5 text-sm rounded-xl gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            loading = false,
            leftIcon,
            rightIcon,
            children,
            disabled,
            className,
            style,
            ...props
        },
        ref
    ) => {
        return (
            <button
                ref={ref}
                disabled={disabled || loading}
                className={classNames(
                    'inline-flex items-center justify-center font-medium transition-all duration-150',
                    'disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]',
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )}
                style={{ ...variantStyles[variant], ...style }}
                {...props}
            >
                {loading ? (
                    <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                ) : (
                    leftIcon
                )}
                {children}
                {!loading && rightIcon}
            </button>
        );
    }
);

Button.displayName = 'Button';