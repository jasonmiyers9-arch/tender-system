import { Badge } from '@/components/ui/Badge';
import type { ScoreBand } from '@/lib/api/types';
import { scoreBandLabel, scoreBandColor } from '@/lib/utils/formatters';

interface StatusBadgeProps {
    status: 'uploaded' | 'verified' | 'rejected' | 'expired';
}

interface ScoreBandBadgeProps {
    band: ScoreBand;
    size?: 'sm' | 'md';
}

const statusVariant = {
    verified: 'success',
    uploaded: 'accent',
    rejected: 'danger',
    expired: 'warning',
} as const;

const statusLabel = {
    verified: 'Verified',
    uploaded: 'Uploaded',
    rejected: 'Rejected',
    expired: 'Expired',
};

export function StatusBadge({ status }: StatusBadgeProps) {
    return (
        <Badge variant={statusVariant[status]} dot>
            {statusLabel[status]}
        </Badge>
    );
}

export function ScoreBandBadge({ band, size = 'md' }: ScoreBandBadgeProps) {
    return (
        <Badge variant={scoreBandColor(band)} size={size} dot>
            {scoreBandLabel(band)}
        </Badge>
    );
}
