import { FolderOpen } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[--color-bg] border border-[--color-border] flex items-center justify-center mb-4 text-[--color-text-muted]">
                {icon ?? <FolderOpen size={28} />}
            </div>
            <h3 className="text-base font-semibold text-[--color-text-primary] mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-[--color-text-muted] max-w-sm mb-5">{description}</p>
            )}
            {action && (
                <Button size="sm" onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
    );
}
