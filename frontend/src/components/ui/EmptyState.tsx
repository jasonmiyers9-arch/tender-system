'use client';

import { FolderOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './Button';
import { fadeUp, T } from '@/lib/motion';

interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="flex flex-col items-center justify-center py-16 px-8 text-center"
        >
            <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={T.softSpring}
                whileHover={{ rotate: [0, -6, 6, 0] }}
                className="w-16 h-16 rounded-2xl bg-[--color-bg] border border-[--color-border] flex items-center justify-center mb-4 text-[--color-text-muted]"
            >
                {icon ?? <FolderOpen size={28} />}
            </motion.div>
            <motion.h3
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...T.smooth, delay: 0.08 }}
                className="text-base font-semibold text-[--color-text-primary] mb-1"
            >
                {title}
            </motion.h3>
            {description && (
                <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...T.smooth, delay: 0.14 }}
                    className="text-sm text-[--color-text-muted] max-w-sm mb-5"
                >
                    {description}
                </motion.p>
            )}
            {action && (
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...T.smooth, delay: 0.2 }}
                >
                    <Button size="sm" onClick={action.onClick}>
                        {action.label}
                    </Button>
                </motion.div>
            )}
        </motion.div>
    );
}
