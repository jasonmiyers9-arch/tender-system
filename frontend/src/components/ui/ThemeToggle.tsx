'use client';

import { useTheme } from 'next-themes';
import { Button } from './Button';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-8 h-8" />;
    }

    const isDark = resolvedTheme === 'dark';

    return (
        <Button
            variant="ghost"
            size="sm"
            className="p-2 relative !bg-transparent hover:!bg-[--color-bg]"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isDark ? (
                <Sun size={18} className="text-[--color-text-muted] hover:text-[--color-primary]" />
            ) : (
                <Moon size={18} className="text-[--color-text-muted] hover:text-[--color-primary]" />
            )}
        </Button>
    );
}
