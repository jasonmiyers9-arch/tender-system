import type { VaultDocument, VaultDocumentDetail, DocumentStatus, DocumentCategory } from './types';

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
        return res.json();
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
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        return res.json();
    },

    async renewDocument(_id: string): Promise<{ success: boolean }> {
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
