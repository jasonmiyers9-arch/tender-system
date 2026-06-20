'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const routeLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    vault: 'Compliance Vault',
    tenders: 'Tender Matches',
    company: 'Company',
    profile: 'Profile',
    verify: 'Verify',
    admin: 'Admin',
    companies: 'Companies',
    audit: 'Audit Log',
    assistant: 'AI Compliance Advisor',
};

export function Breadcrumbs() {
    const pathname = usePathname();
    const segments = pathname.split('/').filter(Boolean);

    if (segments.length === 0) return null;

    const crumbs = segments.map((seg, idx) => {
        const href = '/' + segments.slice(0, idx + 1).join('/');
        const isLast = idx === segments.length - 1;
        // Try to resolve a human-readable label
        const label = routeLabels[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        return { href, label, isLast };
    });

    return (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
            <Link href="/home" className="text-[--color-text-muted] hover:text-[--color-primary] transition-colors text-xs">
                Home
            </Link>
            {crumbs.map((crumb) => (
                <span key={crumb.href} className="flex items-center gap-1">
                    <ChevronRight size={12} className="text-[--color-text-muted]" />
                    {crumb.isLast ? (
                        <span className="text-[--color-text-primary] font-medium text-xs">{crumb.label}</span>
                    ) : (
                        <Link
                            href={crumb.href}
                            className="text-[--color-text-muted] hover:text-[--color-primary] transition-colors text-xs"
                        >
                            {crumb.label}
                        </Link>
                    )}
                </span>
            ))}
        </nav>
    );
}
