'use client';

import { Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { fadeUp, T } from '@/lib/motion';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    /** Icon background color (hex). Falls back to indigo. */
    iconColor?: string;
}

/**
 * Consistent page header with gradient banner matching the home-page style.
 * Use on every top-level (app) page for visual consistency.
 */
export function PageHeader({ title, subtitle, icon, actions, iconColor = '#4F46E5' }: PageHeaderProps) {
    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="relative overflow-hidden rounded-xl px-4 py-5 sm:rounded-2xl sm:px-8 sm:py-6"
            style={{
                background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E3A5C 100%)',
            }}
        >
            {/* Animated sheen */}
            <motion.div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)',
                    backgroundSize: '200% 100%',
                }}
                animate={{ backgroundPosition: ['-100% 0%', '200% 0%'] }}
                transition={{ repeat: Infinity, duration: 7, ease: 'linear' }}
            />

            {/* Watermark */}
            <motion.div
                aria-hidden
                className="absolute -right-4 -bottom-4 opacity-[0.06]"
                animate={{ rotate: [0, 6, 0] }}
                transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }}
            >
                <Shield size={120} color="white" />
            </motion.div>

            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                    {icon && (
                        <motion.div
                            initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            transition={{ ...T.softSpring, delay: 0.05 }}
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11"
                            style={{ background: `${iconColor}30`, color: 'white' }}
                        >
                            {icon}
                        </motion.div>
                    )}
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...T.smooth, delay: 0.08 }}
                            className="break-words text-lg font-extrabold leading-tight text-white sm:text-2xl"
                        >
                            {title}
                        </motion.h1>
                        {subtitle && (
                            <motion.p
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ ...T.smooth, delay: 0.14 }}
                                className="mt-1 text-sm leading-snug"
                                style={{ color: '#C7D2FE' }}
                            >
                                {subtitle}
                            </motion.p>
                        )}
                    </div>
                </div>
                {actions && (
                    <motion.div
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...T.smooth, delay: 0.18 }}
                        className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-shrink-0"
                    >
                        {actions}
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}
