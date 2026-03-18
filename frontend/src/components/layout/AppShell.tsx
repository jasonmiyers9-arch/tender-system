'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAppStore } from '@/store/useAppStore';
import { auth } from '@/lib/api/auth';
import { companies } from '@/lib/api/companies';
import { useMarkNotificationRead, useUnreadNotifications } from '@/lib/hooks/useNotifications';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export function AppShell({ children }: { children: React.ReactNode }) {
    const { mockToken, currentUser, setCurrentUser, setActiveCompany, logout } = useAppStore();
    const [sessionReady, setSessionReady] = useState(false);
    const [dismissed, setDismissed] = useState<string[]>([]);
    const unreadQuery = useUnreadNotifications(5);
    const markRead = useMarkNotificationRead();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!mockToken) {
            setSessionReady(false);
            router.push('/login');
            return;
        }

        setSessionReady(false);
        let cancelled = false;
        auth.me()
            .then(async (user) => {
                if (cancelled) return;
                setCurrentUser(user);
                try {
                    const active = await companies.getActive('current');
                    if (!cancelled && active?.id) {
                        setActiveCompany(active.id);
                    }
                } catch {
                    // Keep UI alive even if active-company sync fails.
                }
                if (!cancelled) {
                    setSessionReady(true);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    logout();
                    setSessionReady(false);
                    router.push('/login');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [mockToken, router, setCurrentUser, setActiveCompany, logout]);

    useEffect(() => {
        if (!mockToken) return;
        if (!currentUser) return;

        if (pathname.startsWith('/admin') && currentUser.role !== 'admin') {
            router.push(currentUser.role === 'evaluator' ? '/provider/dashboard' : '/dashboard');
            return;
        }

        if (pathname.startsWith('/provider') && currentUser.role !== 'evaluator') {
            router.push(currentUser.role === 'admin' ? '/admin/dashboard' : '/dashboard');
            return;
        }

        if (currentUser.role === 'user') {
            const onboardingAllowedRoutes = ['/onboarding', '/vault'];
            const canAccessDuringOnboarding = onboardingAllowedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
            if (currentUser.onboardingCompleted === false && !canAccessDuringOnboarding) {
                router.push('/onboarding');
                return;
            }
            if (pathname.startsWith('/admin') || pathname.startsWith('/provider')) {
                router.push('/dashboard');
                return;
            }
        }

        if (currentUser.role === 'evaluator' && !pathname.startsWith('/provider') && pathname !== '/verify' && !pathname.startsWith('/tenders/calendar')) {
            router.push('/provider/dashboard');
            return;
        }

        if (currentUser.role === 'admin' && (pathname === '/dashboard' || pathname === '/verify')) {
            router.push('/admin/dashboard');
        }
    }, [mockToken, currentUser, pathname, router]);

    useEffect(() => {
        if (!mockToken) return;

        const sendHeartbeat = () => {
            fetch(`${API_BASE}/ops/frontend/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    route: pathname,
                    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
                }),
            }).catch(() => {
                // Intentionally silent for UI continuity
            });
        };

        sendHeartbeat();
        const timer = setInterval(sendHeartbeat, 60000);
        return () => clearInterval(timer);
    }, [mockToken, pathname]);

    const popup = (unreadQuery.data ?? []).find((n) => !dismissed.includes(n.id));

    if (!mockToken || !sessionReady) {
        return (
            <div className="flex h-screen items-center justify-center bg-[--color-bg]">
                <div className="w-8 h-8 border-2 border-[--color-primary] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-[--color-bg]">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
                <Topbar />
                <main className="flex-1 overflow-auto p-6">
                    {children}
                </main>
            </div>

            {popup && (
                <div className="fixed bottom-5 right-5 z-50 w-[360px] rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-4 shadow-lg">
                    <p className="text-sm font-semibold text-[--color-text-primary]">{popup.title}</p>
                    <p className="mt-1 text-sm text-[--color-text-muted]">{popup.message}</p>
                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            className="text-xs text-[--color-text-muted] hover:underline"
                            onClick={() => setDismissed((s) => [...s, popup.id])}
                        >
                            Dismiss
                        </button>
                        <button
                            className="text-xs text-[--color-primary] hover:underline"
                            onClick={() => {
                                markRead.mutate(popup.id);
                                setDismissed((s) => [...s, popup.id]);
                            }}
                        >
                            Mark as read
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
