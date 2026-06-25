'use client';

import { motion } from 'motion/react';
import { classNames } from '@/lib/utils/formatters';
import { fadeUp, T } from '@/lib/motion';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    header?: React.ReactNode;
    footer?: React.ReactNode;
    onClick?: () => void;
    /** If true, renders a 3px indigo-purple gradient stripe at top of card */
    accent?: boolean;
    /** Disable entrance animation. Default: animates on mount. */
    noAnimate?: boolean;
    /** Stagger delay (s) for entrance — useful inside grids */
    delay?: number;
}

const paddingClasses = {
    none: '',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-5 sm:p-8',
};

export function Card({
    children,
    className,
    padding = 'md',
    header,
    footer,
    onClick,
    accent = false,
    noAnimate = false,
    delay,
}: CardProps) {
    return (
        <motion.div
            onClick={onClick}
            initial={noAnimate ? false : 'hidden'}
            animate="show"
            variants={fadeUp}
            transition={delay !== undefined ? { ...T.smooth, delay } : T.smooth}
            whileHover={onClick ? { y: -3, transition: T.snappy } : undefined}
            className={classNames(
                'card-shadow overflow-hidden rounded-xl border border-[--color-border] bg-[--color-surface] sm:rounded-2xl',
                onClick ? 'cursor-pointer hover:border-[--color-border-strong] hover:shadow-lg' : '',
                className
            )}
        >
            {accent && (
                <motion.div
                    className="h-0.5 w-full flex-shrink-0"
                    style={{
                        background:
                            'linear-gradient(90deg, #4F46E5, #7C3AED, #3B82F6, #7C3AED, #4F46E5)',
                        backgroundSize: '200% 100%',
                    }}
                    animate={{ backgroundPosition: ['0% 50%', '100% 50%'] }}
                    transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
                />
            )}
            {header && (
                <div className="flex flex-col gap-3 border-b border-[--color-border] bg-[--color-surface-raised] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 sm:rounded-t-2xl">
                    {header}
                </div>
            )}
            <div className={paddingClasses[padding]}>{children}</div>
            {footer && (
                <div className="border-t border-[--color-border] bg-[--color-surface-raised] px-4 py-3 sm:px-6 sm:py-4 sm:rounded-b-2xl">
                    {footer}
                </div>
            )}
        </motion.div>
    );
}
