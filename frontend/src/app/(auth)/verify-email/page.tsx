import { Suspense } from 'react';
import VerifyEmailClient from './VerifyEmailClient';

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="w-full max-w-md mx-auto px-4 sm:px-0">Verifying your email...</div>}>
            <VerifyEmailClient />
        </Suspense>
    );
}
