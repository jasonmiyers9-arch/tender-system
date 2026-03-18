'use client';

import { forwardRef } from 'react';
import { classNames } from '@/lib/utils/formatters';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
    primary:
        'bg-[--color-primary] hover:bg-[--color-primary-dark] text-[--color-text-primary] shadow-sm',
    secondary:
        'bg-[--color-secondary] hover:opacity-90 text-[--color-text-primary] shadow-sm',
    ghost:
        'bg-transparent hover:bg-[--color-bg] text-[--color-text-primary] border border-[--color-border]',
    danger:
        'bg-[--color-danger] hover:opacity-90 text-[--color-text-primary] shadow-sm',
    success:
        'bg-[--color-success] hover:opacity-90 text-[--color-text-primary] shadow-sm',
};

const sizeClasses: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
    md: 'px-4 py-2 text-sm rounded-lg gap-2',
    lg: 'px-6 py-2.5 text-base rounded-lg gap-2',
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
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )}
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

