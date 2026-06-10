import type { ComplianceScore, ScoreHistoryPoint } from './types';
import { resolveApiBase } from './base';

const API_BASE = resolveApiBase();

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem('tenderguard-app-state');
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed?.state?.token ?? null;
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
    async getCurrent(): Promise<ComplianceScore> {
        const res = await authFetch('/score/current');
        return res.json();
    },

    async getHistory(): Promise<ScoreHistoryPoint[]> {
        const res = await authFetch('/score/history');
        return res.json();
    },
};

