'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shield, AlertCircle, Clock, Lock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { auth } from '@/lib/api/auth';
import { Input } from '@/components/ui/Input';

type BannerConfig = { icon: React.FC<{ size: number; className?: string }>; text: string; accent: string };

const SESSION_MESSAGES: Record<string, BannerConfig> = {
    session_expired: {
        icon: Lock,
        text: 'Your session has expired. Please sign in again to continue.',
        accent: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300',
    },
    inactivity: {
        icon: Clock,
        text: 'You were signed out due to inactivity. Sign in to resume your session.',
        accent: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300',
    },
    auth_required: {
        icon: AlertCircle,
        text: 'Please sign in to access this page.',
        accent: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-300',
    },
};

function safeDestination(value: string | null): string {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/admin')) return '/home';
    return value;
}

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { settoken, setCurrentUser } = useAppStore();

    const reason = searchParams.get('reason') ?? '';
    const destination = safeDestination(searchParams.get('next'));
    const sessionBanner = SESSION_MESSAGES[reason] ?? null;

    const handleGoogleSignIn = async () => {
        setError(null);
        setLoading(true);
        try {
            const res = await auth.googleSignIn();
            settoken(res.token);
            setCurrentUser(res.user);
            if (res.user.onboardingCompleted === false) {
                router.push('/onboarding');
            } else if (res.user.role === 'evaluator') {
                router.push(destination.startsWith('/verify') || destination.startsWith('/evaluator') ? destination : '/evaluator/dashboard');
            } else {
                router.push(destination);
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Google sign-in failed';
            setError(msg.includes('admin_portal_required') ? 'Admin accounts use the internal sign-in portal.' : msg);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        await signIn(email, password, destination);
    };

    const signIn = async (loginEmail: string, loginPassword: string, destination = '/home') => {
        if (!loginEmail || !loginPassword) return setError('Please enter both email and password.');
        setError(null);
        setLoading(true);
        try {
            setEmail(loginEmail);
            setPassword(loginPassword);
            const res = await auth.login(loginEmail, loginPassword);
            settoken(res.token);
            setCurrentUser(res.user);
            if (res.user.onboardingCompleted === false) {
                router.push('/onboarding');
            } else if (res.user.role === 'evaluator') {
                router.push(destination.startsWith('/verify') || destination.startsWith('/evaluator') ? destination : '/evaluator/dashboard');
            } else {
                router.push(destination);
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Invalid credentials';
            if (msg.includes('admin_portal_required')) {
                setError('Admin accounts use the internal sign-in portal.');
            } else if (msg.includes('account_pending')) {
                setError('Your account is awaiting admin approval.');
            } else if (msg.includes('account_rejected')) {
                setError('Your account was rejected. Please contact support/admin.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-sm mx-auto px-4 sm:px-0">
            {/* Logo + heading */}
            <div className="flex flex-col items-center mb-8 gap-4">
                <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                >
                    <Shield size={26} color="white" strokeWidth={2} />
                </div>
                <div className="text-center space-y-1">
                    <h1 className="text-2xl font-bold text-[--color-text-primary] tracking-tight">Welcome back</h1>
                    <p className="text-sm text-[--color-text-muted]">Sign in to Tender Guard Pro</p>
                </div>
            </div>

            {/* Session banner */}
            {sessionBanner && (() => {
                const BannerIcon = sessionBanner.icon;
                return (
                    <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${sessionBanner.accent}`}>
                        <BannerIcon size={15} className="mt-0.5 flex-shrink-0" />
                        <span>{sessionBanner.text}</span>
                    </div>
                );
            })()}

            {/* Card */}
            <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] shadow-md overflow-hidden">
                {/* Colour-accent top stripe */}
                <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #4F46E5, #7C3AED, #3B82F6)' }} />

                <div className="px-8 pt-7 pb-8 space-y-5">
                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25">
                            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-red-700 dark:text-red-400 font-medium">{error}</p>
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handleLogin}>
                        <Input
                            id="email"
                            type="email"
                            label="Email address"
                            placeholder="you@company.co.za"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="text-sm font-semibold text-[--color-text-primary]">
                                    Password
                                </label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs font-semibold text-[--color-primary] hover:opacity-75 transition-opacity"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {/* Primary button — fully visible gradient */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity duration-150 disabled:opacity-70 disabled:cursor-not-allowed"
                            style={{
                                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                                boxShadow: '0 4px 16px rgba(79,70,229,0.35)',
                            }}
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Signing in...
                                </>
                            ) : 'Sign In'}
                        </button>

                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleGoogleSignIn}
                            className="w-full h-11 rounded-xl border border-[--color-border] text-sm font-semibold text-[--color-text-primary] flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed"
                            style={{ background: 'white' }}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Continue with Google
                        </button>
                    </form>

                    {/* Register link */}
                    <p className="text-center text-sm text-[--color-text-muted] pt-1">
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className="font-semibold text-[--color-primary] hover:underline">
                            Create one now
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center bg-[--color-bg]">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
