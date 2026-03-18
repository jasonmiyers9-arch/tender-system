import type { ComplianceScore, ScoreHistoryPoint } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem('tenderguard-app-state');
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed?.state?.mockToken ?? null;
    } catch {
        return null;
    }
}

async function authFetch(path: string, init?: RequestInit) {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Request failed (${res.status}): ${text || path}`);
    }
    return res;
}

export const score = {
    async getCurrent(_companyId: string): Promise<ComplianceScore> {
        const res = await authFetch('/score/current');
        return res.json();
    },

    async getHistory(_companyId: string): Promise<ScoreHistoryPoint[]> {
        const res = await authFetch('/score/history');
        return res.json();
    },
};
