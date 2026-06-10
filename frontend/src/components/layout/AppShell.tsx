'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { PageTransition } from './PageTransition';
import { useAppStore } from '@/store/useAppStore';
import { auth } from '@/lib/api/auth';
import { companies } from '@/lib/api/companies';
import { useMarkNotificationRead, useUnreadNotifications } from '@/lib/hooks/useNotifications';
import { signOutFirebase } from '@/lib/firebaseClient';
import { overlay, popToast, slideUpPanel, T } from '@/lib/motion';

/** Inactivity limits */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;   // 30 min → force logout
const IDLE_WARNING_MS = 28 * 60 * 1000;   // 28 min → show warning (2 min before)

function isAdminRole(role: string | null | undefined): boolean {
    return role === 'admin' || role === 'super_admin';
}

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
    const loginPath = pathname.startsWith('/admin') ? '/admin/login' : '/login';

    // ─── 1. Auth guard — instant render if session already in store ──────────
    // currentUser + token are persisted in localStorage via Zustand persist.
    // After hydration both are available immediately — no API call needed to render.
    // auth.me() runs once per token (tracked via ref) to avoid infinite loops.
    const authCheckedRef = useRef(false);

    useEffect(() => {
        if (!_hasHydrated) return;

        if (!token) {
            authCheckedRef.current = false;
            setSessionReady(false);
            router.push(`${loginPath}?reason=auth_required`);
            return;
        }

        // Only run the auth check once per token — prevents loop caused by
        // setCurrentUser triggering a re-render that would re-fire this effect.
        if (authCheckedRef.current) return;
        authCheckedRef.current = true;

        // If we already have the user from localStorage → show UI immediately
        if (currentUser) {
            setSessionReady(true);
            // Background refresh — silently update user + company without blocking UI
            let cancelled = false;
            auth.me()
                .then(async (user) => {
                    if (cancelled) return;
                    setCurrentUser(user);
                    if (user.role === 'user') {
                        try {
                            const active = await companies.getActive();
                            if (!cancelled && active?.id) setActiveCompany(active.id);
                        } catch {
                            /* non-blocking */
                        }
                    }
                })
                .catch(async () => {
                    if (!cancelled) {
                        await signOutFirebase();
                        logout();
                        router.push(`${loginPath}?reason=session_expired`);
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
                if (user.role === 'user') {
                    try {
                        const active = await companies.getActive();
                        if (!cancelled && active?.id) setActiveCompany(active.id);
                    } catch {
                        /* non-blocking */
                    }
                }
                if (!cancelled) setSessionReady(true);
            })
            .catch(async () => {
                if (!cancelled) {
                    await signOutFirebase();
                    logout();
                    router.push(`${loginPath}?reason=session_expired`);
                }
            });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_hasHydrated, loginPath, token]);

    // ─── 2. Role-based route guard ────────────────────────────────────────────
    useEffect(() => {
        if (!token || !currentUser) return;

        if (pathname.startsWith('/admin') && !isAdminRole(currentUser.role)) {
            router.push(currentUser.role === 'evaluator' ? '/verify' : '/dashboard');
            return;
        }
        if (pathname.startsWith('/provider')) {
            if (currentUser.role !== 'evaluator') {
                router.push(isAdminRole(currentUser.role) ? '/admin/dashboard' : '/dashboard');
                return;
            }
        }
        if (currentUser.role === 'user') {
            if (pathname.startsWith('/admin') || pathname.startsWith('/provider')) {
                router.push('/dashboard');
                return;
            }
            if (
                currentUser.onboardingCompleted === false
                && pathname !== '/onboarding'
                && pathname !== '/vault'
            ) {
                router.push('/onboarding');
                return;
            }
        }
        if (
            currentUser.role === 'evaluator'
            && pathname !== '/verify'
            && !pathname.startsWith('/verify/company')
            && !pathname.startsWith('/provider')
            && !pathname.startsWith('/tenders/calendar')
            && pathname !== '/home'
        ) {
            router.push('/provider/dashboard');
            return;
        }
        if (isAdminRole(currentUser.role) && (pathname === '/dashboard' || pathname === '/verify')) {
            router.push('/admin/dashboard');
        }
    }, [token, currentUser, pathname, router]);

    // ─── 3. Inactivity / idle session timeout ────────────────────────────────
    const forceLogout = useCallback(async () => {
        setIdleWarning(false);
        if (countdownRef.current) clearInterval(countdownRef.current);
        await signOutFirebase();
        logout();
        router.push(`${loginPath}?reason=inactivity`);
    }, [loginPath, logout, router]);

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
            fetch(`/api/ops/frontend/heartbeat`, {
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

    // Operator persona on /admin should not see user-persona notifications (tax doc verified, etc.).
    const suppressPopup = isAdminRole(currentUser?.role) || pathname.startsWith('/admin');
    const popup = suppressPopup ? undefined : (unreadQuery.data ?? []).find((n) => !dismissed.includes(n.id));

    // ─── Loading state ────────────────────────────────────────────────────────
    // Only blocks on first-ever load (no currentUser in store yet).
    // Returning users: _hasHydrated resolves instantly + sessionReady set immediately.
    if (!_hasHydrated || !sessionReady) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex h-screen flex-col items-center justify-center bg-[--color-bg] gap-6"
            >
                {/* Branded logo mark */}
                <div className="relative">
                    <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={T.softSpring}
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                    >
                        <span className="text-xl font-bold text-white tracking-tight">TG</span>
                    </motion.div>
                    <motion.div
                        className="absolute inset-0 w-14 h-14 rounded-2xl"
                        style={{ background: 'var(--color-primary)' }}
                        animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
                    />
                </div>
                {/* Animated progress bar */}
                <div className="w-48 h-1 rounded-full bg-[--color-border] overflow-hidden">
                    <motion.div
                        className="h-full w-1/2 rounded-full bg-[--color-primary]"
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                    />
                </div>
                <motion.p
                    className="text-sm text-[--color-text-muted]"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                >
                    Preparing your workspace…
                </motion.p>
            </motion.div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <Topbar />
                <main className="flex-1 overflow-auto p-6 lg:p-8" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <PageTransition>{children}</PageTransition>
                </main>
            </div>

            {/* Notification popup */}
            <AnimatePresence>
                {popup && (
                    <motion.div
                        key={`popup-${popup.id}`}
                        variants={popToast}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="fixed bottom-5 right-5 z-50 w-[360px] rounded-xl border border-amber-500/30 bg-[--color-surface] p-4 shadow-xl card-shadow"
                    >
                        <p className="text-sm font-semibold text-[--color-text-primary]">{popup.title}</p>
                        <p className="mt-1 text-sm text-[--color-text-muted]">{popup.message}</p>
                        <div className="mt-3 flex justify-end gap-2">
                            <button className="text-xs text-[--color-text-muted] hover:underline cursor-pointer" onClick={() => setDismissed((s) => [...s, popup.id])}>
                                Dismiss
                            </button>
                            <button className="text-xs text-[--color-primary] hover:underline cursor-pointer" onClick={() => { markRead.mutate(popup.id); setDismissed((s) => [...s, popup.id]); }}>
                                Mark as read
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Idle session warning modal */}
            <AnimatePresence>
                {idleWarning && (
                    <motion.div
                        key="idle-overlay"
                        variants={overlay}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    >
                        <motion.div
                            key="idle-panel"
                            variants={slideUpPanel}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="w-[420px] rounded-2xl bg-[--color-surface] p-8 card-shadow border border-amber-500/30 text-center"
                        >
                            <motion.div
                                animate={{ rotate: [0, -8, 8, -6, 6, 0] }}
                                transition={{ repeat: Infinity, repeatDelay: 1.6, duration: 0.7, ease: 'easeInOut' }}
                                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/25"
                            >
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            </motion.div>
                            <h2 className="text-lg font-bold text-[--color-text-primary] mb-2">Session About to Expire</h2>
                            <p className="text-sm text-[--color-text-muted] mb-1">
                                You have been inactive for a while. For your security, you will be signed out in:
                            </p>
                            <motion.p
                                key={idleCountdown}
                                initial={{ scale: 1.1, opacity: 0.7 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={T.snappy}
                                className="text-4xl font-bold text-amber-500 my-4 tabular-nums"
                            >
                                {String(Math.floor(idleCountdown / 60)).padStart(2, '0')}:{String(idleCountdown % 60).padStart(2, '0')}
                            </motion.p>
                            <p className="text-xs text-[--color-text-muted] mb-6">Move your mouse or press any key to stay signed in.</p>
                            <div className="flex gap-3 justify-center">
                                <motion.button
                                    whileHover={{ y: -1, scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={resetIdleTimers}
                                    className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold cursor-pointer"
                                    style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}
                                >
                                    Stay Signed In
                                </motion.button>
                                <motion.button
                                    whileHover={{ y: -1 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={forceLogout}
                                    className="px-5 py-2.5 rounded-xl bg-[--color-surface-raised] border border-[--color-border] text-sm font-medium text-[--color-text-muted] hover:text-[--color-text-primary] cursor-pointer"
                                >
                                    Sign Out Now
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
