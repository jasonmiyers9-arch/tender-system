import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

export function ErrorState({
    title = 'Something went wrong',
    message = 'There was a problem loading this data. Please try again.',
    onRetry,
}: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] flex items-center justify-center mb-4 text-[--color-danger]">
                <AlertTriangle size={28} />
            </div>
            <h3 className="text-base font-semibold text-[--color-text-primary] mb-1">{title}</h3>
            <p className="text-sm text-[--color-text-muted] max-w-sm mb-5">{message}</p>
            {onRetry && (
                <Button variant="ghost" size="sm" onClick={onRetry}>
                    Try Again
                </Button>
            )}
        </div>
    );
}
