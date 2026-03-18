'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, FolderLock, FileSearch, Building2, Calendar,
    ShieldCheck, BarChart2, Users, ClipboardList, Activity, UserCheck,
    ChevronLeft, ChevronRight, Shield,
} from 'lucide-react';
import { classNames } from '@/lib/utils/formatters';
import { useAppStore } from '@/store/useAppStore';
import type { UserRole } from '@/store/useAppStore';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    roles?: UserRole[];
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        label: 'Main',
        items: [
            { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
            { label: 'Compliance Vault', href: '/vault', icon: <FolderLock size={18} /> },
            { label: 'Tender Matches', href: '/tenders', icon: <FileSearch size={18} /> },
            { label: 'Tender Calendar', href: '/tenders/calendar', icon: <Calendar size={18} /> },
            { label: 'Company Profile', href: '/company/profile', icon: <Building2 size={18} /> },
        ],
    },
    {
        label: 'Evaluator',
        items: [
            {
                label: 'Verify Companies',
                href: '/verify',
                icon: <ShieldCheck size={18} />,
                roles: ['evaluator', 'admin'],
            },
        ],
    },
    {
        label: 'Administration',
        items: [
            {
                label: 'Admin Dashboard',
                href: '/admin/dashboard',
                icon: <BarChart2 size={18} />,
                roles: ['admin'],
            },
            {
                label: 'Accounts / Companies',
                href: '/admin/accounts',
                icon: <UserCheck size={18} />,
                roles: ['admin'],
            },
            {
                label: 'Companies',
                href: '/admin/companies',
                icon: <Users size={18} />,
                roles: ['admin'],
            },
            {
                label: 'Audit Log',
                href: '/admin/audit',
                icon: <ClipboardList size={18} />,
                roles: ['admin'],
            },
            {
                label: 'Frontend Monitor',
                href: '/admin/monitor',
                icon: <Activity size={18} />,
                roles: ['admin'],
            },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const { sidebarCollapsed, toggleSidebar, currentUser } = useAppStore();
    const role = currentUser?.role ?? 'user';

    const isActive = (href: string) =>
        pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

    const canSee = (item: NavItem) =>
        !item.roles || item.roles.includes(role);

    return (
        <aside
            className={classNames(
                'flex flex-col bg-[--color-sidebar-bg] text-[--color-sidebar-text] transition-all duration-200 flex-shrink-0',
                sidebarCollapsed ? 'w-16' : 'w-60'
            )}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
                <div className="w-8 h-8 rounded-lg bg-[--color-accent] flex items-center justify-center flex-shrink-0">
                    <Shield size={16} className="text-[--color-text-primary]" />
                </div>
                {!sidebarCollapsed && (
                    <div>
                        <p className="text-sm font-bold text-[--color-sidebar-text] leading-tight">TenderGuard</p>
                        <p className="text-[10px] text-[--color-sidebar-text] opacity-60 uppercase tracking-wider">Pro</p>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 space-y-6 px-2">
                {navGroups.map((group) => {
                    const visibleItems = group.items.filter(canSee);
                    if (visibleItems.length === 0) return null;
                    return (
                        <div key={group.label}>
                            {!sidebarCollapsed && (
                                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest opacity-60 text-[--color-sidebar-text]">
                                    {group.label}
                                </p>
                            )}
                            <ul className="space-y-0.5">
                                {visibleItems.map((item) => (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            title={sidebarCollapsed ? item.label : undefined}
                                            className={classNames(
                                                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                                                isActive(item.href)
                                                    ? 'bg-[--color-sidebar-active] text-[--color-sidebar-text]'
                                                    : 'text-[--color-sidebar-text] opacity-75 hover:opacity-100 hover:bg-white/10'
                                            )}
                                        >
                                            <span className="flex-shrink-0">{item.icon}</span>
                                            {!sidebarCollapsed && <span>{item.label}</span>}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </nav>

            {/* Collapse toggle */}
            <div className="border-t border-white/10 p-2">
                <button
                    onClick={toggleSidebar}
                    className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-white/10 text-[--color-sidebar-text] opacity-60 hover:opacity-100 transition-all"
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>
        </aside>
    );
}

