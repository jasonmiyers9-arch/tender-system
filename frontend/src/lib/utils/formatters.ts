import type { ScoreBand, DocumentStatus } from '../api/types';

export function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function scoreBandLabel(band: ScoreBand): string {
    const labels: Record<ScoreBand, string> = {
        'tender-ready': 'Tender Ready',
        'partially-ready': 'Partially Ready',
        'high-risk': 'High Risk',
    };
    return labels[band];
}

export function scoreBandColor(band: ScoreBand): 'success' | 'warning' | 'danger' {
    const map: Record<ScoreBand, 'success' | 'warning' | 'danger'> = {
        'tender-ready': 'success',
        'partially-ready': 'warning',
        'high-risk': 'danger',
    };
    return map[band];
}

export function scoreFromNumber(score: number): ScoreBand {
    if (score >= 85) return 'tender-ready';
    if (score >= 65) return 'partially-ready';
    return 'high-risk';
}

export function docStatusColor(
    status: DocumentStatus
): 'success' | 'warning' | 'danger' | 'accent' {
    const map: Record<DocumentStatus, 'success' | 'warning' | 'danger' | 'accent'> = {
        verified: 'success',
        uploaded: 'accent',
        rejected: 'danger',
        expired: 'warning',
    };
    return map[status];
}

export function docStatusLabel(status: DocumentStatus): string {
    const labels: Record<DocumentStatus, string> = {
        verified: 'Verified',
        uploaded: 'Uploaded',
        rejected: 'Rejected',
        expired: 'Expired',
    };
    return labels[status];
}

export function docCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
        tax: 'Tax',
        legal: 'Legal',
        financial: 'Financial',
        certification: 'Certification',
        bbbee: 'B-BBEE',
        registration: 'Registration',
    };
    return labels[category] ?? category;
}

export function daysUntilExpiry(expiryDate: string | null): number | null {
    if (!expiryDate) return null;
    const diff = new Date(expiryDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function classNames(...classes: (string | undefined | false | null)[]): string {
    return classes.filter(Boolean).join(' ');
}
