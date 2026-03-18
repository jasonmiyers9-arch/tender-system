import { forwardRef } from 'react';
import { classNames } from '@/lib/utils/formatters';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    hint?: string;
    options: { value: string; label: string }[];
    placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, hint, options, placeholder, className, id, ...props }, ref) => {
        const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
        return (
            <div className="flex flex-col gap-1.5">
                {label && (
                    <label
                        htmlFor={selectId}
                        className="text-sm font-medium text-[--color-text-primary]"
                    >
                        {label}
                    </label>
                )}
                <select
                    ref={ref}
                    id={selectId}
                    className={classNames(
                        'w-full rounded-lg border px-4 py-2.5 text-sm bg-[var(--color-surface)] text-[--color-text-primary] opacity-100',
                        'appearance-none cursor-pointer transition-colors duration-150',
                        'focus:outline-none focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary]',
                        error
                            ? 'border-[--color-danger]'
                            : 'border-[--color-border] hover:border-[--color-secondary]',
                        className
                    )}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                {error && <p className="text-xs text-[--color-danger]">{error}</p>}
                {hint && !error && <p className="text-xs text-[--color-text-muted]">{hint}</p>}
            </div>
        );
    }
);

Select.displayName = 'Select';
