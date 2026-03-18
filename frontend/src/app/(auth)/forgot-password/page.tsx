'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { auth } from '@/lib/api/auth';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (email.trim()) {
                await auth.forgotPassword(email);
                setSent(true);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto px-4 sm:px-0">
            <Card padding="lg" className="shadow-lg border-opacity-60">

                {sent ? (
                    <div className="text-center space-y-4 py-4">
                        <div className="mx-auto w-12 h-12 rounded-full bg-[#DCFCE7] flex items-center justify-center mb-2 shadow-inner">
                            <CheckCircle2 size={24} className="text-[--color-success]" />
                        </div>
                        <h2 className="text-xl font-bold text-[--color-text-primary]">Check your inbox</h2>
                        <p className="text-sm text-[--color-text-muted]">
                            We have sent a password reset link to <b>{email}</b>. Please check your spam folder if you do not see it.
                        </p>
                        <div className="pt-4">
                            <Link href="/login">
                                <Button variant="ghost" className="w-full text-sm">Return to Sign In</Button>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-[--color-text-primary]">Reset your password</h2>
                            <p className="text-sm text-[--color-text-muted] mt-2">
                                Enter your email address and we will send you a link to reset your password.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <Input
                                type="email"
                                label="Email address"
                                placeholder="you@company.co.za"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                            <Button type="submit" loading={loading} className="w-full h-11 mt-2 text-base">
                                Send Reset Link
                            </Button>
                        </form>

                        <div className="mt-6 pt-4 border-t border-[--color-border] text-center">
                            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-[--color-text-muted] hover:text-[--color-primary] transition-colors gap-1">
                                <ArrowLeft size={16} /> Back to Log in
                            </Link>
                        </div>
                    </div>
                )}

            </Card>
        </div>
    );
}
