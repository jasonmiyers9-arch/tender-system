'use client';

import { Download } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

type ButtonProps = ComponentPropsWithoutRef<typeof Button>;

type DownloadButtonProps = Omit<ButtonProps, 'leftIcon' | 'children'> & {
    children?: ReactNode;
    ariaLabel?: string;
    iconSize?: number;
};

export function DownloadButton({
    children,
    ariaLabel,
    iconSize = 14,
    size = 'sm',
    variant = 'ghost',
    ...props
}: DownloadButtonProps) {
    const label = ariaLabel ?? (typeof children === 'string' ? children : 'Download');

    return (
        <Button
            {...props}
            size={size}
            variant={variant}
            leftIcon={<Download size={iconSize} />}
            aria-label={label}
            title={label}
        >
            {children}
        </Button>
    );
}
