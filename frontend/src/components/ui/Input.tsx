import { forwardRef } from 'react';
import { classNames } from '@/lib/utils/formatters';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, hint, leftIcon, className, id, ...props }, ref) => {
        const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
        return (
            <div className="flex flex-col gap-1.5">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-sm font-medium text-[--color-text-primary]"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]">
                            {leftIcon}
                        </span>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        className={classNames(
                            'w-full rounded-lg border text-sm bg-[--color-surface] text-[--color-text-primary]',
                            'placeholder:text-[--color-text-muted] transition-colors duration-150',
                            'focus:outline-none focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary]',
                            error
                                ? 'border-[--color-danger]'
                                : 'border-[--color-border] hover:border-[--color-secondary]',
                            leftIcon ? 'pl-10 pr-4 py-2.5' : 'px-4 py-2.5',
                            className
                        )}
                        {...props}
                    />
                </div>
                {error && <p className="text-xs text-[--color-danger]">{error}</p>}
                {hint && !error && <p className="text-xs text-[--color-text-muted]">{hint}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';
