'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { auth } from '@/lib/api/auth';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

/** Maps ?reason= query param values to human-readable banners */
const SESSION_MESSAGES: Record<string, { icon: string; text: string; color: string }> = {
    session_expired: {
        icon: '🔒',
        text: 'Your session has expired. Please sign in again to continue.',
        color: 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400',
    },
    inactivity: {
        icon: '⏱',
        text: 'You were signed out due to inactivity. Sign in to resume your session.',
        color: 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400',
    },
    auth_required: {
        icon: '🔐',
        text: 'Please sign in to access this page.',
        color: 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-400',
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return setError('Please enter both email and password.');
        setError(null);
        setLoading(true);

        try {
            const res = await auth.login(email, password);
            settoken(res.token);
            setCurrentUser(res.user);
            if (res.user.role === 'admin') {
                router.push('/admin/dashboard');
            } else if (res.user.role === 'evaluator') {
                router.push('/provider/dashboard');
            } else if (res.user.onboardingCompleted === false) {
                router.push('/onboarding');
            } else {
                router.push('/dashboard');
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
        <div className="w-full max-w-md mx-auto relative px-4 sm:px-0">
            <div className="flex flex-col items-center mb-8">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mb-3 shadow-md" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
                    <Shield size={24} color="white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[--color-text-primary]">
                    Sign in to TenderGuard Pro
                </h1>
            </div>

            {/* Session reason banner */}
            {sessionBanner && (
                <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${sessionBanner.color}`}>
                    <span className="text-base leading-none mt-0.5">{sessionBanner.icon}</span>
                    <span>{sessionBanner.text}</span>
                </div>
            )}

            <Card padding="lg" className="shadow-lg border-opacity-60">
                <form className="space-y-5" onSubmit={handleLogin}>
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 text-[--color-danger] text-xs border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <Input
                        id="email"
                        type="email"
                        label="Email address"
                        placeholder="vusu@zenithcontractors.co.za"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-[--color-text-primary]">Password</label>
                            <Link href="/forgot-password" className="text-xs font-semibold text-[--color-primary] hover:text-[--color-primary-dark]">
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

                    <Button type="submit" loading={loading} className="w-full h-11 mt-2 text-base">
                        Sign In
                    </Button>
                </form>

                <div className="mt-6 border-t border-[--color-border] pt-6"></div>

                <div className="space-y-4">
                    <p className="text-xs text-center text-[--color-text-muted]">
                        System login:
                        <br />Admin: <b>Mouse</b>
                        <br />Evaluator: <b>Vusu</b>
                    </p>
                    <p className="text-center text-sm text-[--color-text-muted]">
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className="font-semibold text-[--color-primary] hover:underline">
                            Create one now
                        </Link>
                    </p>
                </div>
            </Card>
        </div>
    );
}

// useSearchParams() requires a Suspense boundary in Next.js App Router
export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}

