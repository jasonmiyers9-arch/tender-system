'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shield, AlertCircle, Clock, Lock, Zap } from 'lucide-react';
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

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { settoken, setCurrentUser } = useAppStore();

    const reason = searchParams.get('reason') ?? '';
    const sessionBanner = SESSION_MESSAGES[reason] ?? null;

    const DEMO_ACCOUNTS = [
        { role: 'Admin',     name: 'Mouse', email: 'mouse@tenderguard.dev', password: 'Demo@1234', color: '#6366F1' },
        { role: 'Evaluator', name: 'Vusu',  email: 'vusu@tenderguard.dev',  password: 'Demo@1234', color: '#0EA5E9' },
    ];

    const quickLogin = async (demoEmail: string, demoPassword: string) => {
        setEmail(demoEmail);
        setPassword(demoPassword);
        setError(null);
        setLoading(true);
        try {
            const res = await auth.login(demoEmail, demoPassword);
            settoken(res.token);
            setCurrentUser(res.user);
            if (res.user.onboardingCompleted === false) {
                router.push('/onboarding');
            } else {
                router.push('/home');
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Demo login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return setError('Please enter both email and password.');
        setError(null);
        setLoading(true);
        try {
            const res = await auth.login(email, password);
            settoken(res.token);
            setCurrentUser(res.user);
            if (res.user.onboardingCompleted === false) {
                router.push('/onboarding');
            } else {
                router.push('/home');
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Invalid credentials';
            if (msg.includes('account_email_unverified')) {
                setError('Please verify your email first before signing in.');
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
                    <p className="text-sm text-[--color-text-muted]">Sign in to TenderGuard Pro</p>
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
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3 pt-1">
                        <div className="flex-1 h-px bg-[--color-border]" />
                        <span className="text-[11px] font-medium text-[--color-text-muted] uppercase tracking-wider">quick demo login</span>
                        <div className="flex-1 h-px bg-[--color-border]" />
                    </div>

                    {/* Demo accounts — one-click login */}
                    <div className="grid grid-cols-2 gap-2.5">
                        {DEMO_ACCOUNTS.map((demo) => (
                            <button
                                key={demo.role}
                                type="button"
                                disabled={loading}
                                onClick={() => quickLogin(demo.email, demo.password)}
                                className="group relative rounded-xl border border-[--color-border] px-3 py-3 text-left transition-all duration-150 hover:border-transparent disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                                style={{ background: 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))' }}
                            >
                                {/* Hover fill */}
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                                    style={{ background: `linear-gradient(135deg, ${demo.color}12, ${demo.color}06)` }}
                                />
                                <div className="relative flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <span
                                            className="text-[10px] font-bold uppercase tracking-wider"
                                            style={{ color: demo.color }}
                                        >
                                            {demo.role}
                                        </span>
                                        <Zap
                                            size={11}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ color: demo.color }}
                                        />
                                    </div>
                                    <p className="text-sm font-bold text-[--color-text-primary]">{demo.name}</p>
                                    <p className="text-[10px] text-[--color-text-muted] truncate">{demo.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>

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
