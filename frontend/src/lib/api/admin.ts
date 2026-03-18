import type { AdminStats, RenewalItem, AuditEntry, Company, VaultDocument } from './types';
import {
    mockAuditLog,
} from './mockData';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

export const admin = {
    async getPortfolioStats(): Promise<AdminStats> {
        const res = await authFetch('/admin/dashboard/stats');
        return res.json();
    },

    async getRenewalsPipeline(): Promise<RenewalItem[]> {
        const res = await authFetch('/admin/dashboard/renewals');
        return res.json();
    },

    async getAuditLog(filters?: {
        page?: number;
        pageSize?: number;
    }): Promise<{ entries: AuditEntry[]; total: number }> {
        await delay(400);
        const page = filters?.page ?? 1;
        const pageSize = filters?.pageSize ?? 20;
        const start = (page - 1) * pageSize;
        return {
            entries: mockAuditLog.slice(start, start + pageSize),
            total: mockAuditLog.length,
        };
    },

    async listCompanies(): Promise<Company[]> {
        const res = await authFetch('/companies');
        const json = await res.json() as { items: Company[] };
        return json.items;
    },

    async markDocumentVerified(docId: string): Promise<{ success: boolean }> {
        const res = await authFetch(`/admin/documents/${docId}/verify`, { method: 'POST' });
        const json = await res.json();
        return { success: Boolean(json.ok) };
    },

    async markDocumentRejected(docId: string, reason: string): Promise<{ success: boolean }> {
        const res = await authFetch(`/admin/documents/${docId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
        const json = await res.json();
        return { success: Boolean(json.ok) };
    },

    async listCompanyDocuments(companyId: string) {
        const res = await authFetch(`/admin/companies/${companyId}/documents`);
        return res.json() as Promise<{ items: Array<{ id: string; name: string; category: string; status: string; expiryDate: string | null; lastUpdated: string; uploadedBy: string; fileSize: string; fileType: string; companyName: string }> }>;
    },

    async downloadDocument(docId: string, filename: string) {
        const token = getToken();
        const res = await fetch(`${API_BASE}/admin/documents/${docId}/download`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: 'no-store',
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Request failed (${res.status}): ${text || 'download failed'}`);
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `document-${docId}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    },

    async listAccounts(status?: 'pending' | 'approved' | 'rejected') {
        const suffix = status ? `?status=${status}` : '';
        const res = await authFetch(`/auth/admin/accounts${suffix}`);
        return res.json() as Promise<{ items: Array<{ id: number; name: string; email: string; role: string; verificationStatus: string; createdAt: string; companyName: string; pendingHours: number; slaBreached: boolean }> }>;
    },

    async approveAccount(userId: number) {
        const res = await authFetch(`/auth/admin/accounts/${userId}/approve`, { method: 'POST' });
        return res.json();
    },

    async rejectAccount(userId: number, reason?: string) {
        const res = await authFetch(`/auth/admin/accounts/${userId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
        return res.json();
    },

    async resetPending(userId: number) {
        const res = await authFetch(`/auth/admin/accounts/${userId}/reset-pending`, {
            method: 'POST',
        });
        return res.json();
    },
};
