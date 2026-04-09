import type { VaultDocument, VaultDocumentDetail, DocumentStatus, DocumentCategory } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

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

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
    const token = getToken();
    const headers: Record<string, string> = {
        ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res;
}

export const vault = {
    async listDocuments(filters?: {
        status?: DocumentStatus;
        category?: DocumentCategory;
    }): Promise<VaultDocument[]> {
        const params = new URLSearchParams();
        if (filters?.status) params.set('status', filters.status);
        if (filters?.category) params.set('category', filters.category);
        const suffix = params.toString() ? `?${params.toString()}` : '';
        const res = await authFetch(`/documents${suffix}`);
        const json: unknown = await res.json();

        // Some API paths return { items: [] } on soft failures; normalize to an array for callers.
        if (Array.isArray(json)) return json as VaultDocument[];
        if (json && typeof json === 'object' && 'items' in json) {
            const items = (json as { items?: unknown }).items;
            return Array.isArray(items) ? (items as VaultDocument[]) : [];
        }
        return [];
    },

    async getDocument(id: string): Promise<VaultDocumentDetail> {
        const res = await authFetch(`/documents/${id}`);
        return res.json();
    },

    async uploadDocument(data: {
        name: string;
        category: DocumentCategory;
        file: File;
    }): Promise<VaultDocument> {
        const token = getToken();
        const form = new FormData();
        form.set('file', data.file, data.file.name || `${data.name}.pdf`);
        form.set('category', data.category);

        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/documents/upload`, {
            method: 'POST',
            headers,
            body: form,
        });
        if (!res.ok) {
            let detail = '';
            try {
                const json = await res.json() as { detail?: string };
                detail = json.detail ? `: ${json.detail}` : '';
            } catch {
                // ignore json parse errors and keep generic message
            }
            throw new Error(`Upload failed (${res.status})${detail}`);
        }
        return res.json();
    },

    async renewDocument(id: string, data: { issueDate?: string; expiryDate?: string }): Promise<{ success: boolean }> {
        await authFetch(`/documents/${id}/renew`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issue_date: data.issueDate, expiry_date: data.expiryDate }),
        });
        return { success: true };
    },

    async requestVerification(id: string): Promise<{ ok: boolean; status: string }> {
        const res = await authFetch(`/documents/${id}/request-verification`, { method: 'POST' });
        return res.json();
    },

    getDownloadUrl(id: string): string {
        return `${API_BASE}/documents/${id}/download`;
    },
};
