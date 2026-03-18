import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ShieldAlert } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 bg-[--color-bg] rounded-full flex items-center justify-center mb-6 text-[--color-danger] outline outline-[8px] outline-[#FEE2E2]">
                <ShieldAlert size={40} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[--color-text-primary] mb-2">404</h1>
            <h2 className="text-xl font-semibold text-[--color-text-primary] mb-4">Page Not Found</h2>
            <p className="text-[--color-text-muted] max-w-sm mb-8">
                The page you are looking for doesn&apos;t exist or has been moved.
            </p>
            <Link href="/">
                <Button>Return to Dashboard</Button>
            </Link>
        </div>
    );
}
