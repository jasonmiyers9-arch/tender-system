import type { TenderMatch, TenderDetail, TenderReadiness, TenderCalendarItem } from './types';
import { resolveApiBase } from './base';

export type ProviderTender = TenderMatch;

export interface TenderSearchFilters {
    q?: string;
    province?: string;
    category?: string;
    buyer?: string;
    tenderType?: string;
    briefing?: 'any' | 'true' | 'compulsory';
    closingWithin?: number;
    minValue?: number;
    maxValue?: number;
    minScore?: number;
}

export interface SavedTenderSearch {
    id: string;
    name: string;
    filters: TenderSearchFilters;
    frequency: 'daily' | 'weekly' | 'paused';
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTenderPayload {
    title: string;
    organization: string;
    deadline: string;
    value: string;
    category: string;
    description: string;
    requirements: string[];
    required_categories: string[];
    eligibilityCriteria: string[];
    location?: string;
    status?: 'draft' | 'published';
}

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

export const tenders = {
    async listMatches(filters?: TenderSearchFilters): Promise<TenderMatch[]> {
        const params = new URLSearchParams();
        Object.entries(filters ?? {}).forEach(([key, value]) => {
            if (value !== undefined && value !== '' && value !== 'any') params.set(key, String(value));
        });
        const res = await authFetch(`/tenders${params.size ? `?${params}` : ''}`);
        return res.json();
    },

    async listSavedSearches(): Promise<SavedTenderSearch[]> {
        const res = await authFetch('/tenders/saved-searches');
        const json = await res.json() as { searches: SavedTenderSearch[] };
        return json.searches ?? [];
    },

    async saveSearch(payload: { name: string; filters: TenderSearchFilters; frequency?: SavedTenderSearch['frequency'] }): Promise<SavedTenderSearch> {
        const res = await authFetch('/tenders/saved-searches', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return res.json();
    },

    async deleteSavedSearch(id: string): Promise<{ ok: boolean }> {
        const res = await authFetch(`/tenders/saved-searches/${id}`, { method: 'DELETE' });
        return res.json();
    },

    async getTender(id: string): Promise<TenderDetail> {
        const res = await authFetch(`/tenders/${id}`);
        return res.json();
    },

    async getReadiness(id: string): Promise<TenderReadiness> {
        const res = await authFetch(`/tenders/${id}/readiness`);
        return res.json();
    },

    async getCalendar(): Promise<TenderCalendarItem[]> {
        const res = await authFetch('/tenders/calendar');
        const json = await res.json() as { items: TenderCalendarItem[] };
        return json.items ?? [];
    },

    async downloadCalendarIcs(filename = 'tender-deadlines.ics') {
        const token = getToken();
        const res = await fetch(`${API_BASE}/tenders/calendar.ics`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: 'no-store',
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Request failed (${res.status}): ${text || 'calendar export failed'}`);
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    },

    async downloadTenderDocument(tenderId: string, index?: number) {
        const token = getToken();
        const query = typeof index === 'number' ? `?index=${index}` : '';
        const res = await fetch(`${API_BASE}/tenders/${tenderId}/document${query}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: 'no-store',
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Request failed (${res.status}): ${text || 'Tender document download failed'}`);
        }
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') ?? '';
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'tender.pdf';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    },

    async downloadBidPack(tenderId: string) {
        const token = getToken();
        const res = await fetch(`${API_BASE}/tenders/${tenderId}/bid-pack?format=html`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: 'no-store',
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Request failed (${res.status}): ${text || 'Bid pack generation failed'}`);
        }
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') ?? '';
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'bid-pack.html';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    },
    async downloadSbdPack(tenderId?: string) {
        const token = getToken();
        const params = new URLSearchParams();
        if (tenderId) params.set('tenderId', tenderId);
        const res = await fetch(`${API_BASE}/sbd-forms${params.size ? `?${params}` : ''}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: 'no-store',
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Request failed (${res.status}): ${text || 'SBD pack generation failed'}`);
        }
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') ?? '';
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'sbd-pack.html';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    },
    async createTender(payload: CreateTenderPayload) {
        const res = await authFetch('/tenders', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return res.json();
    },

    async listProviderTenders(): Promise<TenderMatch[]> {
        const res = await authFetch('/tenders?mine=true');
        return res.json();
    },

    async updateTender(id: string, payload: CreateTenderPayload) {
        const res = await authFetch(`/tenders/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
        return res.json();
    },

    async deleteTender(id: string): Promise<{ ok: boolean }> {
        const res = await authFetch(`/tenders/${id}`, { method: 'DELETE' });
        return res.json();
    },
};

