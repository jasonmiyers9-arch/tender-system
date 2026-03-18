'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Check, Building2 } from 'lucide-react';
import { classNames } from '@/lib/utils/formatters';
import { useAppStore } from '@/store/useAppStore';
import { useCompanies, useSwitchCompany } from '@/lib/hooks/useCompanies';

export function EntitySwitcher() {
    const [open, setOpen] = useState(false);
    const { activeCompanyId } = useAppStore();
    const { data: companies = [] } = useCompanies();
    const { mutateAsync: switchCompany, isPending } = useSwitchCompany();
    const router = useRouter();
    const pathname = usePathname();

    const active = companies.find((c) => c.id === activeCompanyId) ?? companies[0];

    return (
        <div className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className={classNames(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border border-[--color-border]',
                    'bg-[--color-bg] hover:bg-white transition-colors text-sm font-medium text-[--color-text-primary]',
                    'max-w-[220px]'
                )}
            >
                <Building2 size={15} className="text-[--color-primary] flex-shrink-0" />
                <span className="truncate">{active?.name ?? 'Select company'}</span>
                <ChevronDown size={14} className="text-[--color-text-muted] flex-shrink-0 ml-auto" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute top-full mt-1 right-0 z-40 w-72 bg-[var(--color-surface)] border border-[--color-border] rounded-xl shadow-lg py-1 overflow-hidden opacity-100">
                        <p className="px-4 py-2 text-[10px] uppercase tracking-widest text-[--color-text-muted] font-semibold border-b border-[--color-border]">
                            Switch Entity
                        </p>
                        {companies.map((company) => (
                            <button
                                key={company.id}
                                disabled={isPending}
                                onClick={async () => {
                                    try {
                                        await switchCompany(company.id);
                                        setOpen(false);
                                        router.refresh();
                                        if (pathname?.startsWith('/admin')) {
                                            router.push('/company/profile');
                                        }
                                    } catch (e) {
                                        alert(e instanceof Error ? e.message : 'Failed to switch company');
                                    }
                                }}
                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[--color-bg] transition-colors text-left disabled:opacity-60"
                            >
                                <div className="w-7 h-7 rounded-md bg-[--color-primary] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-[--color-text-primary] text-[10px] font-bold">
                                        {company.name.charAt(0)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[--color-text-primary] truncate">
                                        {company.name}
                                    </p>
                                    <p className="text-xs text-[--color-text-muted]">{company.registrationNumber}</p>
                                </div>
                                {company.id === activeCompanyId && (
                                    <Check size={15} className="text-[--color-success] flex-shrink-0 mt-1" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

