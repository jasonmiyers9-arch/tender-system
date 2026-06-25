'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
    LayoutDashboard, FolderLock, FileSearch, Building2, Calendar,
    ShieldCheck, BarChart2, Users, ClipboardList, Activity, UserCheck,
    ChevronRight, Shield, Home, Brain, Bot, Globe, RefreshCw, Bell, History, X,
} from 'lucide-react';
import { classNames } from '@/lib/utils/formatters';
import { useAppStore } from '@/store/useAppStore';
import { T } from '@/lib/motion';

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
        label: 'Company',
        items: [
            { label: 'Home', href: '/home', icon: <Home size={18} /> },
            { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
            { label: 'Compliance Vault', href: '/vault', icon: <FolderLock size={18} /> },
            { label: 'Renewals', href: '/renewals', icon: <RefreshCw size={18} /> },
            { label: 'AI Knowledge', href: '/knowledge', icon: <Brain size={18} /> },
            { label: 'AI Compliance Advisor', href: '/assistant', icon: <Bot size={18} /> },
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
        label: 'Evaluator',
        items: [
            { label: 'Overview', href: '/evaluator/dashboard', icon: <LayoutDashboard size={18} /> },
            { label: 'Company Search', href: '/verify', icon: <ShieldCheck size={18} /> },
            { label: 'Verification Activity', href: '/evaluator/activity', icon: <History size={18} /> },
            { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
        ],
    },
];

const adminNavGroups: NavGroup[] = [
    {
        label: 'Admin',
        items: [
            { label: 'Home', href: '/home', icon: <Home size={18} /> },
            { label: 'Admin Dashboard', href: '/admin/dashboard', icon: <BarChart2 size={18} /> },
            { label: 'Tender Oversight', href: '/admin/tenders', icon: <FileSearch size={18} /> },
            { label: 'Tender Scraper', href: '/admin/scraper', icon: <Globe size={18} /> },
            { label: 'Document Review', href: '/admin/documents', icon: <ShieldCheck size={18} /> },
            { label: 'Accounts', href: '/admin/accounts', icon: <UserCheck size={18} /> },
            { label: 'Companies', href: '/admin/companies', icon: <Users size={18} /> },
            { label: 'Audit Log', href: '/admin/audit', icon: <ClipboardList size={18} /> },
            { label: 'Frontend Monitor', href: '/admin/monitor', icon: <Activity size={18} /> },
        ],
    },
];

type SidebarProps = {
    mobileOpen?: boolean;
    onCloseMobile?: () => void;
};

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
    const pathname = usePathname();
    const { sidebarCollapsed, toggleSidebar, currentUser } = useAppStore();
    const role = currentUser?.role ?? 'user';

    const isActive = (href: string) =>
        href === '/evaluator/dashboard'
            ? pathname === '/evaluator/dashboard'
            : href === '/verify'
            ? pathname === '/verify' || pathname.startsWith('/verify/company')
            : href === '/home'
                ? pathname === '/home'
                : (pathname === href || (!['/dashboard', '/admin/dashboard', '/provider/dashboard'].includes(href) && pathname.startsWith(href)));

    const navGroups = role === 'admin' || role === 'super_admin'
        ? adminNavGroups
        : role === 'evaluator'
            ? providerNavGroups
            : companyNavGroups;

    const sidebarStyle: React.CSSProperties = {
        backgroundColor: 'var(--color-sidebar-bg)',
        borderRight: '1px solid var(--color-sidebar-border)',
    };

    function renderSidebarContent(mobile = false) {
        const collapsed = !mobile && sidebarCollapsed;

        return (
            <>
                <div
                    style={{ borderBottom: '1px solid var(--color-sidebar-border)', height: 60 }}
                    className="flex items-center gap-3 px-4 flex-shrink-0"
                >
                    <motion.div
                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.05 }}
                        transition={{ duration: 0.5 }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                    >
                        <Shield size={15} color="#fff" />
                    </motion.div>
                    <AnimatePresence initial={false}>
                        {!collapsed && (
                            <motion.div
                                key="brand-text"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                transition={T.snappy}
                                className="min-w-0 flex-1"
                            >
                                <p className="text-sm font-bold leading-tight tracking-tight" style={{ color: '#F1F5F9' }}>Tender Guard Pro</p>
                                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#6366F1' }}>Pro Platform</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {mobile && (
                        <button
                            type="button"
                            onClick={onCloseMobile}
                            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                            aria-label="Close navigation"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
                    {navGroups.map((group) => (
                        <div key={group.label}>
                            <AnimatePresence initial={false}>
                                {!collapsed && (
                                    <motion.p
                                        key={`label-${group.label}`}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={T.snappy}
                                        className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest overflow-hidden"
                                        style={{ color: '#64748B' }}
                                    >
                                        {group.label}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                            <ul className="space-y-0.5">
                                {group.items.map((item) => {
                                    const active = isActive(item.href);
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                title={collapsed ? item.label : undefined}
                                                onClick={mobile ? onCloseMobile : undefined}
                                                className={classNames(
                                                    'group relative flex items-center gap-2.5 rounded-lg text-[13.5px] no-underline cursor-pointer min-h-10',
                                                    collapsed ? 'px-2.5 py-2 justify-center' : 'px-3 py-2',
                                                    active ? 'font-semibold' : 'font-medium'
                                                )}
                                                style={{
                                                    color: active
                                                        ? 'var(--color-sidebar-text-active)'
                                                        : 'var(--color-sidebar-text)',
                                                }}
                                            >
                                                {active && (
                                                    <motion.span
                                                        layoutId={mobile ? 'mobile-sidebar-active' : 'sidebar-active'}
                                                        className="absolute inset-0 rounded-lg"
                                                        style={{
                                                            background: 'var(--color-sidebar-active-bg)',
                                                            borderLeft: '2px solid #6366F1',
                                                        }}
                                                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                                    />
                                                )}
                                                {!active && (
                                                    <span className="absolute inset-0 rounded-lg bg-white/0 group-hover:bg-white/[0.05] transition-colors" />
                                                )}
                                                <motion.span
                                                    whileHover={!active ? { x: 2 } : undefined}
                                                    transition={T.snappy}
                                                    className="relative z-10 flex items-center gap-2.5 w-full min-w-0"
                                                >
                                                    <span className="flex-shrink-0" style={{ opacity: active ? 1 : 0.75 }}>
                                                        {item.icon}
                                                    </span>
                                                    <AnimatePresence initial={false}>
                                                        {!collapsed && (
                                                            <motion.span
                                                                key="lbl"
                                                                initial={{ opacity: 0, width: 0 }}
                                                                animate={{ opacity: 1, width: 'auto' }}
                                                                exit={{ opacity: 0, width: 0 }}
                                                                transition={T.snappy}
                                                                className="truncate whitespace-nowrap"
                                                            >
                                                                {item.label}
                                                            </motion.span>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {!mobile && (
                    <div style={{ borderTop: '1px solid var(--color-sidebar-border)' }} className="p-2">
                        <motion.button
                            onClick={toggleSidebar}
                            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                            whileTap={{ scale: 0.94 }}
                            className="w-full flex items-center justify-center p-2 rounded-lg cursor-pointer text-[#475569] hover:text-[#94A3B8]"
                            style={{ background: 'transparent', border: 'none' }}
                        >
                            <motion.span
                                animate={{ rotate: sidebarCollapsed ? 0 : 180 }}
                                transition={T.softSpring}
                            >
                                <ChevronRight size={15} />
                            </motion.span>
                        </motion.button>
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            <motion.aside
                style={sidebarStyle}
                animate={{ width: sidebarCollapsed ? 64 : 240 }}
                transition={T.softSpring}
                className="hidden md:flex flex-col flex-shrink-0 h-full overflow-hidden"
            >
                {renderSidebarContent(false)}
            </motion.aside>

            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        key="mobile-sidebar"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={T.snappy}
                        className="fixed inset-0 z-50 md:hidden"
                    >
                        <button
                            type="button"
                            aria-label="Close navigation overlay"
                            onClick={onCloseMobile}
                            className="absolute inset-0 h-full w-full bg-black/45 backdrop-blur-[2px]"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={T.softSpring}
                            style={sidebarStyle}
                            className="relative z-10 flex h-[100dvh] w-[min(86vw,320px)] flex-col overflow-hidden shadow-2xl"
                        >
                            {renderSidebarContent(true)}
                        </motion.aside>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}