'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { auth } from '@/lib/api/auth';

export default function VerifyEmailClient() {
    const params = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your email...');

    useEffect(() => {
        const token = params.get('token');
        if (!token) {
            // Update status based on token presence - intentional pattern
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStatus('error');
            setMessage('Missing verification token.');
            return;
        }
        auth.verifyEmail(token)
            .then(() => {
                setStatus('ok');
                setMessage('Email verified successfully. Please wait for admin approval, then sign in.');
            })
            .catch((e) => {
                setStatus('error');
                setMessage(e instanceof Error ? e.message : 'Email verification failed.');
            });
    }, [params]);

    return (
        <div className="w-full max-w-md mx-auto px-4 sm:px-0">
            <Card padding="lg" className="shadow-lg border-opacity-60">
                <h1 className="text-xl font-bold text-[--color-text-primary] mb-2">Email Verification</h1>
                <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-[--color-text-muted]'}`}>{message}</p>
                <div className="mt-6">
                    <Button className="w-full" onClick={() => router.push('/login')}>Go to Login</Button>
                </div>
            </Card>
        </div>
    );
}
