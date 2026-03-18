import type { NotificationItem } from './types';

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

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
    const token = getToken();
    const headers: Record<string, string> = {
        ...(init?.headers as Record<string, string> | undefined),
        'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res;
}

export const notificationsApi = {
    async list(unreadOnly = false, limit = 20): Promise<NotificationItem[]> {
        const params = new URLSearchParams();
        if (unreadOnly) params.set('unread_only', 'true');
        params.set('limit', String(limit));
        const res = await authFetch(`/notifications?${params.toString()}`);
        return res.json();
    },

    async markRead(id: string): Promise<{ ok: boolean }> {
        const res = await authFetch(`/notifications/${id}/read`, { method: 'POST' });
        return res.json();
    },

    async markAllRead(): Promise<{ ok: boolean; count: number }> {
        const res = await authFetch('/notifications/mark-all-read', { method: 'POST' });
        return res.json();
    },
};
