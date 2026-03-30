'use client';

import { useState } from 'react';
import { Bell, LogOut, ChevronDown, User, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Breadcrumbs } from './Breadcrumbs';
import { EntitySwitcher } from './EntitySwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store/useAppStore';
import { useUnreadNotifications } from '@/lib/hooks/useNotifications';

const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    evaluator: 'Tender Provider',
    user: 'Company User',
};

export function Topbar() {
    const { currentUser, logout } = useAppStore();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const unreadQuery = useUnreadNotifications(10);
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <header className="h-[60px] flex items-center justify-between px-6 bg-[--color-surface] border-b border-[--color-border] shadow-sm flex-shrink-0 gap-4">
            {/* Left: Breadcrumbs */}
            <div className="flex-1 min-w-0">
                <Breadcrumbs />
            </div>

            {/* Right: Entity switcher + notifications + user */}
            <div className="flex items-center gap-3 flex-shrink-0">
                {currentUser?.role === 'admin' && <EntitySwitcher />}

                <ThemeToggle />

                {/* Notification bell */}
                <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-[--color-bg] text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors">
                    <Bell size={18} />
                    {(unreadQuery.data?.length ?? 0) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[--color-danger] flex items-center justify-center px-1">
                            <span className="text-[10px] font-bold text-white leading-none">
                                {(unreadQuery.data?.length ?? 0) > 9 ? '9+' : unreadQuery.data?.length}
                            </span>
                        </span>
                    )}
                </Link>

                {/* User menu */}
                <div className="relative">
                    <button
                        onClick={() => setUserMenuOpen((o) => !o)}
                        className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg hover:bg-[--color-bg] transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
                            <span className="text-white text-xs font-bold">
                                {currentUser?.name?.charAt(0).toUpperCase() ?? 'U'}
                            </span>
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-xs font-semibold text-[--color-text-primary] leading-tight">
                                {currentUser?.name ?? 'User'}
                            </p>
                            <p className="text-[10px] text-[--color-text-muted]">
                                {roleLabels[currentUser?.role ?? 'user']}
                            </p>
                        </div>
                        <ChevronDown size={12} className="text-[--color-text-muted]" />
                    </button>

                    {userMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                            <div className="absolute top-full mt-1 right-0 z-40 w-52 bg-[var(--color-surface)] border border-[--color-border] rounded-xl shadow-lg py-1 opacity-100">
                                <div className="px-4 py-3 border-b border-[--color-border]">
                                    <p className="text-sm font-semibold text-[--color-text-primary]">{currentUser?.name}</p>
                                    <p className="text-xs text-[--color-text-muted] truncate">{currentUser?.email}</p>
                                    <Badge variant={currentUser?.role === 'admin' ? 'danger' : currentUser?.role === 'evaluator' ? 'accent' : 'default'} size="sm" className="mt-1.5">
                                        {roleLabels[currentUser?.role ?? 'user']}
                                    </Badge>
                                </div>
                                <Link href="/account" onClick={() => setUserMenuOpen(false)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[--color-text-primary] hover:bg-[--color-bg] transition-colors">
                                    <User size={15} className="text-[--color-text-muted]" /> Account
                                </Link>
                                <Link href="/settings" onClick={() => setUserMenuOpen(false)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[--color-text-primary] hover:bg-[--color-bg] transition-colors">
                                    <Settings size={15} className="text-[--color-text-muted]" /> Settings
                                </Link>
                                <div className="border-t border-[--color-border] mt-1">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[--color-danger] hover:bg-red-500/10 transition-colors"
                                    >
                                        <LogOut size={15} /> Sign Out
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}

