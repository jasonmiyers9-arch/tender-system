'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { classNames } from '@/lib/utils/formatters';

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
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={(e) => {
                if (e.target === overlayRef.current) onClose();
            }}
        >
            <div
                className={classNames(
                    'relative w-full rounded-2xl shadow-2xl border border-[--color-border] bg-[var(--color-surface)] opacity-100',
                    sizeClasses[size]
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[--color-border]">
                    <h2 className="text-base font-semibold text-[--color-text-primary]">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-[--color-bg] text-[--color-text-muted] transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">{children}</div>

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-4 border-t border-[--color-border] bg-[--color-bg] rounded-b-2xl flex items-center justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
