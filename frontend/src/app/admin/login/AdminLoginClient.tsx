'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Lock, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { auth } from '@/lib/api/auth';
import { useAppStore } from '@/store/useAppStore';

type BannerConfig = { icon: React.FC<{ size: number; className?: string }>; text: string; accent: string };

const SESSION_MESSAGES: Record<string, BannerConfig> = {
    session_expired: {
        icon: Lock,
        text: 'Your admin session has expired. Sign in again to continue.',
        accent: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300',
    },
    inactivity: {
        icon: Lock,
        text: 'You were signed out due to inactivity. Sign in to resume your admin session.',
        accent: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300',
    },
    auth_required: {
        icon: AlertCircle,
        text: 'Please sign in with an internal admin account.',
        accent: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-300',
    },
};

function AdminLoginForm() {
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
            const res = await auth.adminLogin(email, password);
            settoken(res.token);
            setCurrentUser(res.user);
            router.push('/admin/dashboard');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Invalid credentials';
            if (msg.includes('admin_access_required')) {
                setError('This sign-in is restricted to internal admin accounts.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[--color-bg] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-sm mx-auto px-4 sm:px-0">
                <div className="flex flex-col items-center mb-8 gap-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 55%, #7C2D12 100%)' }}
                    >
                        <ShieldAlert size={26} color="white" strokeWidth={2} />
                    </div>
                    <div className="text-center space-y-1">
                        <h1 className="text-2xl font-bold text-[--color-text-primary] tracking-tight">Internal Admin Sign In</h1>
                        <p className="text-sm text-[--color-text-muted]">Restricted access for platform operators.</p>
                    </div>
                </div>

                {sessionBanner && (() => {
                    const BannerIcon = sessionBanner.icon;
                    return (
                        <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${sessionBanner.accent}`}>
                            <BannerIcon size={15} className="mt-0.5 flex-shrink-0" />
                            <span>{sessionBanner.text}</span>
                        </div>
                    );
                })()}

                <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] shadow-md overflow-hidden">
                    <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #991B1B, #B91C1C, #EA580C)' }} />

                    <div className="px-8 pt-7 pb-8 space-y-5">
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
                                label="Work email"
                                placeholder="name@tenderguard.co.za"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            <Input
                                id="password"
                                type="password"
                                label="Password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity duration-150 disabled:opacity-70 disabled:cursor-not-allowed"
                                style={{
                                    background: 'linear-gradient(135deg, #991B1B 0%, #B91C1C 100%)',
                                    boxShadow: '0 4px 16px rgba(153,27,27,0.35)',
                                }}
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        Signing in...
                                    </>
                                ) : 'Sign In to Admin'}
                            </button>
                        </form>

                        <p className="text-center text-xs text-[--color-text-muted] pt-1">
                            Internal accounts are provisioned separately from company and provider users.
                        </p>

                        <p className="text-center text-sm text-[--color-text-muted] pt-1">
                            Need the external portal?{' '}
                            <Link href="/login" className="font-semibold text-[--color-primary] hover:underline">
                                Go to public sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AdminLoginClient() {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center bg-[--color-bg]">
                <div className="w-8 h-8 border-2 border-rose-700 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <AdminLoginForm />
        </Suspense>
    );
}
