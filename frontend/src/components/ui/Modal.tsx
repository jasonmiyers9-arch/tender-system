'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { classNames } from '@/lib/utils/formatters';
import { overlay, slideUpPanel } from '@/lib/motion';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="modal-overlay"
                    variants={overlay}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="fixed inset-0 z-50 flex items-end justify-center p-3 backdrop-blur-sm sm:items-center sm:p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    <motion.div
                        key="modal-panel"
                        variants={slideUpPanel}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className={classNames(
                            'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[--color-border] bg-[var(--color-surface)] shadow-2xl sm:rounded-2xl',
                            sizeClasses[size]
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 border-b border-[--color-border] px-4 py-3 sm:px-6 sm:py-4">
                            <h2 className="min-w-0 break-words text-base font-semibold leading-snug text-[--color-text-primary]">{title}</h2>
                            <motion.button
                                whileHover={{ rotate: 90, scale: 1.05 }}
                                whileTap={{ scale: 0.92 }}
                                transition={{ duration: 0.18 }}
                                onClick={onClose}
                                className="p-1 rounded-lg hover:bg-[--color-bg] text-[--color-text-muted] cursor-pointer"
                            >
                                <X size={18} />
                            </motion.button>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>

                        {/* Footer */}
                        {footer && (
                            <div className="flex flex-col-reverse gap-2 border-t border-[--color-border] bg-[--color-bg] px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6 sm:py-4 sm:rounded-b-2xl">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
