import type { AdminStats, RenewalItem, AuditEntry, Company } from './types';

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
        try {
            const res = await authFetch('/admin/dashboard/stats');
            return res.json();
        } catch (error) {
            if (error instanceof Error && error.message.includes('(404)')) {
                return {
                    totalCompanies: 0,
                    tenderReady: 0,
                    partiallyReady: 0,
                    highRisk: 0,
                    totalDocuments: 0,
                    pendingVerification: 0,
                };
            }
            throw error;
        }
    },

    async getRenewalsPipeline(): Promise<RenewalItem[]> {
        try {
            const res = await authFetch('/admin/dashboard/renewals');
            return res.json();
        } catch (error) {
            if (error instanceof Error && error.message.includes('(404)')) {
                return [];
            }
            throw error;
        }
    },

    async getAuditLog(filters?: {
        page?: number;
        pageSize?: number;
        actor?: string;
        action?: string;
    }): Promise<{ entries: AuditEntry[]; total: number }> {
        const params = new URLSearchParams();
        if (filters?.page) params.set('page', String(filters.page));
        if (filters?.pageSize) params.set('page_size', String(filters.pageSize));
        if (filters?.actor) params.set('actor', filters.actor);
        if (filters?.action) params.set('action', filters.action);
        const suffix = params.toString() ? `?${params.toString()}` : '';
        try {
            const res = await authFetch(`/admin/audit${suffix}`);
            return res.json();
        } catch (error) {
            if (error instanceof Error && error.message.includes('(404)')) {
                return { entries: [], total: 0 };
            }
            throw error;
        }
    },

    async listCompanies(): Promise<Company[]> {
        const res = await authFetch('/admin/companies');
        const json = await res.json() as { items?: Company[] } | Company[];
        if (Array.isArray(json)) return json;
        return Array.isArray(json.items) ? json.items : [];
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

    async listPendingDocuments() {
        try {
            const res = await authFetch('/admin/documents/pending');
            return res.json() as Promise<{ items: Array<{ id: string; name: string; category: string; status: string; expiryDate: string | null; lastUpdated: string; uploadedBy: string; fileSize: string; fileType: string; companyName: string; companyId: string }> }>;
        } catch (error) {
            if (error instanceof Error && error.message.includes('(404)')) {
                return { items: [] };
            }
            throw error;
        }
    },

    async listCompanyDocuments(companyId: string) {
        try {
            const res = await authFetch(`/admin/companies/${companyId}/documents`);
            return res.json() as Promise<{ items: Array<{ id: string; name: string; category: string; status: string; expiryDate: string | null; lastUpdated: string; uploadedBy: string; fileSize: string; fileType: string; companyName: string; companyId: string }> }>;
        } catch (error) {
            if (error instanceof Error && error.message.includes('(404)')) {
                return { items: [] };
            }
            throw error;
        }
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
        try {
            const res = await authFetch(`/auth/admin/accounts${suffix}`);
            return res.json() as Promise<{ items: Array<{ id: string; name: string; email: string; role: string; verificationStatus: string; createdAt: string; companyName: string; pendingHours: number; slaBreached: boolean }> }>;
        } catch (error) {
            if (error instanceof Error && error.message.includes('(404)')) {
                return { items: [] };
            }
            throw error;
        }
    },

    async approveAccount(userId: string) {
        const res = await authFetch(`/auth/admin/accounts/${userId}/approve`, { method: 'POST' });
        return res.json();
    },

    async rejectAccount(userId: string, reason?: string) {
        const res = await authFetch(`/auth/admin/accounts/${userId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
        return res.json();
    },

    async resetPending(userId: string) {
        const res = await authFetch(`/auth/admin/accounts/${userId}/reset-pending`, {
            method: 'POST',
        });
        return res.json();
    },

    async getAiSettings(): Promise<{
        hasOpenRouterKey: boolean;
        openRouterKeyMasked: string | null;
        openRouterModel: string;
        updatedAt: string | null;
        source: 'admin' | 'env' | 'none';
    }> {
        const res = await authFetch('/admin/ai-settings');
        return res.json();
    },

    async updateAiSettings(payload: {
        openRouterApiKey?: string;
        openRouterModel?: string;
    }): Promise<{
        hasOpenRouterKey: boolean;
        openRouterKeyMasked: string | null;
        openRouterModel: string;
        updatedAt: string | null;
        source: 'admin' | 'env' | 'none';
    }> {
        const res = await authFetch('/admin/ai-settings', {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        return res.json();
    },
};
