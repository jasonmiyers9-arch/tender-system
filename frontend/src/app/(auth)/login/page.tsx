'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { auth } from '@/lib/api/auth';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { setMockToken, setCurrentUser } = useAppStore();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return setError('Please enter both email and password.');
        setError(null);
        setLoading(true);

        try {
            const res = await auth.login(email, password);
            // In a real app we'd set cookies. For the mock we just use Zustand.
            setMockToken(res.token);
            setCurrentUser(res.user);
            if (res.user.role === 'user' && res.user.onboardingCompleted === false) {
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
                <div className="w-12 h-12 rounded-xl bg-[--color-primary] flex items-center justify-center flex-shrink-0 mb-3 shadow-md">
                    <Shield size={24} className="text-[--color-text-primary]" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[--color-text-primary]">
                    Sign in to TenderGuard Pro
                </h1>
            </div>

            <Card padding="lg" className="shadow-lg border-opacity-60">
                <form className="space-y-5" onSubmit={handleLogin}>
                    {error && <div className="p-3 rounded bg-[#FEE2E2] text-[#B91C1C] text-xs border border-[#FCA5A5]">{error}</div>}

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

