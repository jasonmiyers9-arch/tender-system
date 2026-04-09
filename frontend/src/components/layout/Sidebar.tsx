'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, FolderLock, FileSearch, Building2, Calendar,
    ShieldCheck, BarChart2, Users, ClipboardList, Activity, UserCheck,
    ChevronLeft, ChevronRight, Shield, Home, Brain,
} from 'lucide-react';
import { classNames } from '@/lib/utils/formatters';
import { useAppStore } from '@/store/useAppStore';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const companyNavGroups: NavGroup[] = [
    {
        label: 'Company Portal',
        items: [
            { label: 'Home', href: '/home', icon: <Home size={18} /> },
            { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
            { label: 'Compliance Vault', href: '/vault', icon: <FolderLock size={18} /> },
            { label: 'AI Knowledge', href: '/knowledge', icon: <Brain size={18} /> },
            { label: 'Compliance Score', href: '/score', icon: <BarChart2 size={18} /> },
            { label: 'Tender Matches', href: '/tenders', icon: <FileSearch size={18} /> },
            { label: 'Tender Calendar', href: '/tenders/calendar', icon: <Calendar size={18} /> },
            { label: 'My Applications', href: '/applications', icon: <ClipboardList size={18} /> },
            { label: 'Company Profile', href: '/company', icon: <Building2 size={18} /> },
        ],
    },
];

const providerNavGroups: NavGroup[] = [
    {
        label: 'Tender Provider Portal',
        items: [
            { label: 'Home', href: '/home', icon: <Home size={18} /> },
            { label: 'Provider Dashboard', href: '/provider/dashboard', icon: <LayoutDashboard size={18} /> },
            { label: 'Provider Profile', href: '/provider/profile', icon: <Building2 size={18} /> },
            { label: 'My Tenders', href: '/provider/tenders', icon: <FileSearch size={18} /> },
            { label: 'Upload Tender', href: '/provider/tenders/new', icon: <FileSearch size={18} /> },
            { label: 'Tender Review', href: '/verify', icon: <ShieldCheck size={18} /> },
            { label: 'Tender Calendar', href: '/tenders/calendar', icon: <Calendar size={18} /> },
            { label: 'Applications', href: '/provider/applications', icon: <ClipboardList size={18} /> },
        ],
    },
];

const adminNavGroups: NavGroup[] = [
    {
        label: 'Admin Portal',
        items: [
            { label: 'Home', href: '/home', icon: <Home size={18} /> },
            { label: 'Admin Dashboard', href: '/admin/dashboard', icon: <BarChart2 size={18} /> },
            { label: 'Tender Oversight', href: '/admin/tenders', icon: <FileSearch size={18} /> },
            { label: 'Document Review', href: '/admin/documents', icon: <ShieldCheck size={18} /> },
            { label: 'Accounts', href: '/admin/accounts', icon: <UserCheck size={18} /> },
            { label: 'Companies', href: '/admin/companies', icon: <Users size={18} /> },
            { label: 'Audit Log', href: '/admin/audit', icon: <ClipboardList size={18} /> },
            { label: 'Frontend Monitor', href: '/admin/monitor', icon: <Activity size={18} /> },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const { sidebarCollapsed, toggleSidebar, currentUser } = useAppStore();
    const role = currentUser?.role ?? 'user';

    const isActive = (href: string) =>
        href === '/home' ? pathname === '/home' : (pathname === href || (!['/dashboard', '/admin/dashboard', '/provider/dashboard'].includes(href) && pathname.startsWith(href)));

    const navGroups = role === 'admin'
        ? adminNavGroups
        : role === 'evaluator'
            ? providerNavGroups
            : companyNavGroups;

    // Sidebar is ALWAYS dark — enterprise pattern (Linear, Vercel, GitHub all do this)
    const sidebarStyle: React.CSSProperties = {
        backgroundColor: 'var(--color-sidebar-bg)',
        borderRight: '1px solid var(--color-sidebar-border)',
    };

    return (
        <aside
            style={sidebarStyle}
            className={classNames(
                'flex flex-col flex-shrink-0 transition-all duration-200 h-full',
                sidebarCollapsed ? 'w-16' : 'w-60'
            )}
        >
            {/* Brand */}
            <div
                style={{ borderBottom: '1px solid var(--color-sidebar-border)', height: 60 }}
                className="flex items-center gap-3 px-4 flex-shrink-0"
            >
                <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                >
                    <Shield size={15} color="#fff" />
                </div>
                {!sidebarCollapsed && (
                    <div className="min-w-0">
                        <p className="text-sm font-bold leading-tight tracking-tight" style={{ color: '#F1F5F9' }}>TenderGuard</p>
                        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#6366F1' }}>Pro Platform</p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
                {navGroups.map((group) => (
                    <div key={group.label}>
                        {!sidebarCollapsed && (
                            <p
                                className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest"
                                style={{ color: '#374151' }}
                            >
                                {group.label}
                            </p>
                        )}
                        <ul className="space-y-0.5">
                            {group.items.map((item) => {
                                const active = isActive(item.href);
                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            title={sidebarCollapsed ? item.label : undefined}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                padding: sidebarCollapsed ? '8px 10px' : '8px 12px',
                                                borderRadius: 8,
                                                fontSize: 13.5,
                                                fontWeight: active ? 600 : 500,
                                                textDecoration: 'none',
                                                borderLeft: active ? '2px solid #6366F1' : '2px solid transparent',
                                                backgroundColor: active ? 'var(--color-sidebar-active-bg)' : 'transparent',
                                                color: active ? 'var(--color-sidebar-text-active)' : 'var(--color-sidebar-text)',
                                                transition: 'all 120ms ease',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!active) {
                                                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
                                                    (e.currentTarget as HTMLElement).style.color = '#CBD5E1';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!active) {
                                                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                                    (e.currentTarget as HTMLElement).style.color = 'var(--color-sidebar-text)';
                                                }
                                            }}
                                        >
                                            <span className="flex-shrink-0" style={{ opacity: active ? 1 : 0.75 }}>
                                                {item.icon}
                                            </span>
                                            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* Collapse toggle */}
            <div style={{ borderTop: '1px solid var(--color-sidebar-border)' }} className="p-2">
                <button
                    onClick={toggleSidebar}
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 8,
                        borderRadius: 8,
                        color: '#475569',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
                        (e.currentTarget as HTMLElement).style.color = '#94A3B8';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = '#475569';
                    }}
                >
                    {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                </button>
            </div>
        </aside>
    );
}

