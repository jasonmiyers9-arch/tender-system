'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAppStore } from '@/store/useAppStore';
import { auth } from '@/lib/api/auth';
import { companies } from '@/lib/api/companies';
import { useMarkNotificationRead, useUnreadNotifications } from '@/lib/hooks/useNotifications';

/** Inactivity limits */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;   // 30 min → force logout
const IDLE_WARNING_MS = 28 * 60 * 1000;   // 28 min → show warning (2 min before)

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export function AppShell({ children }: { children: React.ReactNode }) {
    const { token, _hasHydrated, currentUser, setCurrentUser, setActiveCompany, logout } = useAppStore();
    const [sessionReady, setSessionReady] = useState(false);
    const [dismissed, setDismissed] = useState<string[]>([]);
    const [idleWarning, setIdleWarning] = useState(false);   // show 2-min countdown warning
    const [idleCountdown, setIdleCountdown] = useState(120); // seconds remaining
    const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const unreadQuery = useUnreadNotifications(5);
    const markRead = useMarkNotificationRead();
    const router = useRouter();
    const pathname = usePathname();

    // ─── 1. Auth guard — instant render if session already in store ──────────
    // currentUser + token are persisted in localStorage via Zustand persist.
    // After hydration both are available immediately — no API call needed to render.
    // auth.me() runs silently in the background to refresh user data.
    useEffect(() => {
        if (!_hasHydrated) return;

        if (!token) {
            // Update session state for auth guard - intentional pattern
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSessionReady(false);
            router.push('/login?reason=auth_required');
            return;
        }

        // If we already have the user from localStorage → show UI immediately
        if (currentUser) {
            setSessionReady(true);
            // Background refresh — silently update user + company without blocking UI
            let cancelled = false;
            auth.me()
                .then(async (user) => {
                    if (cancelled) return;
                    setCurrentUser(user);
                    try {
                        const active = await companies.getActive();
                        if (!cancelled && active?.id) setActiveCompany(active.id);
                    } catch { /* non-blocking */ }
                })
                .catch(() => {
                    if (!cancelled) {
                        logout();
                        router.push('/login?reason=session_expired');
                    }
                });
            return () => { cancelled = true; };
        }

        // No currentUser yet (fresh session after login) — must wait for auth.me()
        let cancelled = false;
        auth.me()
            .then(async (user) => {
                if (cancelled) return;
                setCurrentUser(user);
                try {
                    const active = await companies.getActive();
                    if (!cancelled && active?.id) setActiveCompany(active.id);
                } catch { /* non-blocking */ }
                if (!cancelled) setSessionReady(true);
            })
            .catch(() => {
                if (!cancelled) {
                    logout();
                    router.push('/login?reason=session_expired');
                }
            });
        return () => { cancelled = true; };
    }, [_hasHydrated, token, currentUser, router, setCurrentUser, setActiveCompany, logout]);

    // ─── 2. Role-based route guard ────────────────────────────────────────────
    useEffect(() => {
        if (!token || !currentUser) return;

        if (pathname.startsWith('/admin') && currentUser.role !== 'admin') {
            router.push(currentUser.role === 'evaluator' ? '/provider/dashboard' : '/dashboard');
            return;
        }
        if (pathname.startsWith('/provider') && currentUser.role !== 'evaluator') {
            router.push(currentUser.role === 'admin' ? '/admin/dashboard' : '/dashboard');
            return;
        }
        if (currentUser.role === 'user') {
            if (pathname.startsWith('/admin') || pathname.startsWith('/provider')) {
                router.push('/dashboard');
                return;
            }
        }
        if (currentUser.role === 'evaluator' && !pathname.startsWith('/provider') && pathname !== '/verify' && !pathname.startsWith('/tenders/calendar') && pathname !== '/home') {
            router.push('/provider/dashboard');
            return;
        }
        if (currentUser.role === 'admin' && (pathname === '/dashboard' || pathname === '/verify')) {
            router.push('/admin/dashboard');
        }
    }, [token, currentUser, pathname, router]);

    // ─── 3. Inactivity / idle session timeout ────────────────────────────────
    const forceLogout = useCallback(() => {
        setIdleWarning(false);
        if (countdownRef.current) clearInterval(countdownRef.current);
        logout();
        router.push('/login?reason=inactivity');
    }, [logout, router]);

    const resetIdleTimers = useCallback(() => {
        if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setIdleWarning(false);
        setIdleCountdown(120);

        // At 28 min: show 2-min countdown warning
        warnTimerRef.current = setTimeout(() => {
            setIdleWarning(true);
            setIdleCountdown(120);
            countdownRef.current = setInterval(() => {
                setIdleCountdown((s) => {
                    if (s <= 1) {
                        if (countdownRef.current) clearInterval(countdownRef.current);
                        return 0;
                    }
                    return s - 1;
                });
            }, 1000);
        }, IDLE_WARNING_MS);

        // At 30 min: force logout
        idleTimerRef.current = setTimeout(forceLogout, IDLE_TIMEOUT_MS);
    }, [forceLogout]);

    useEffect(() => {
        if (!token || !sessionReady) return;

        const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        const handleActivity = () => resetIdleTimers();

        // Initialize idle timers on mount - intentional pattern
        // eslint-disable-next-line react-hooks/set-state-in-effect
        resetIdleTimers();
        ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

        return () => {
            if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
        };
    }, [token, sessionReady, resetIdleTimers]);

    // ─── 4. Heartbeat ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!token) return;
        const sendHeartbeat = () => {
            fetch(`${API_BASE}/ops/frontend/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    route: pathname,
                    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
                }),
            }).catch(() => { /* silent */ });
        };
        sendHeartbeat();
        const timer = setInterval(sendHeartbeat, 60_000);
        return () => clearInterval(timer);
    }, [token, pathname]);

    const popup = (unreadQuery.data ?? []).find((n) => !dismissed.includes(n.id));

    // ─── Loading state ────────────────────────────────────────────────────────
    // Only blocks on first-ever load (no currentUser in store yet).
    // Returning users: _hasHydrated resolves instantly + sessionReady set immediately.
    if (!_hasHydrated || !sessionReady) {
        return (
            <div className="flex h-screen items-center justify-center bg-[--color-bg]">
                <div className="w-8 h-8 border-2 border-[--color-primary] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <Topbar />
                <main className="flex-1 overflow-auto p-6 lg:p-8" style={{ backgroundColor: 'var(--color-bg)' }}>
                    {children}
                </main>
            </div>

            {/* Notification popup */}
            {popup && (
                <div className="fixed bottom-5 right-5 z-50 w-[360px] rounded-xl border border-amber-500/30 bg-[--color-surface] p-4 shadow-xl card-shadow">
                    <p className="text-sm font-semibold text-[--color-text-primary]">{popup.title}</p>
                    <p className="mt-1 text-sm text-[--color-text-muted]">{popup.message}</p>
                    <div className="mt-3 flex justify-end gap-2">
                        <button className="text-xs text-[--color-text-muted] hover:underline" onClick={() => setDismissed((s) => [...s, popup.id])}>
                            Dismiss
                        </button>
                        <button className="text-xs text-[--color-primary] hover:underline" onClick={() => { markRead.mutate(popup.id); setDismissed((s) => [...s, popup.id]); }}>
                            Mark as read
                        </button>
                    </div>
                </div>
            )}

            {/* Idle session warning modal */}
            {idleWarning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-[420px] rounded-2xl bg-[--color-surface] p-8 card-shadow border border-amber-500/30 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/25">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-[--color-text-primary] mb-2">Session About to Expire</h2>
                        <p className="text-sm text-[--color-text-muted] mb-1">
                            You have been inactive for a while. For your security, you will be signed out in:
                        </p>
                        <p className="text-4xl font-bold text-amber-500 my-4 tabular-nums">
                            {String(Math.floor(idleCountdown / 60)).padStart(2, '0')}:{String(idleCountdown % 60).padStart(2, '0')}
                        </p>
                        <p className="text-xs text-[--color-text-muted] mb-6">Move your mouse or press any key to stay signed in.</p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={resetIdleTimers}
                                className="px-5 py-2.5 rounded-xl bg-[--color-primary] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                            >
                                Stay Signed In
                            </button>
                            <button
                                onClick={forceLogout}
                                className="px-5 py-2.5 rounded-xl bg-[--color-surface-raised] border border-[--color-border] text-sm font-medium text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors"
                            >
                                Sign Out Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
