import type { CompanySearchResult, CompanyComplianceReport } from './types';
import { resolveApiBase } from './base';

const API_BASE = resolveApiBase();

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem('tenderguard-app-state');
    if (!raw) return null;
    try {
        return JSON.parse(raw)?.state?.token ?? null;
    } catch {
        return null;
    }
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
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

export const verify = {
    async searchCompanies(query: string): Promise<CompanySearchResult[]> {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        const suffix = params.toString() ? `?${params.toString()}` : '';
        const res = await authFetch(`/verify/companies${suffix}`);
        return res.json();
    },

    async getCompanyReport(companyId: string): Promise<CompanyComplianceReport> {
        const res = await authFetch(`/verify/companies/${companyId}/report`);
        return res.json();
    },

    async getBundleUrl(companyId: string): Promise<{ url: string }> {
        const res = await authFetch(`/verify/companies/${companyId}/bundle-url`);
        return res.json();
    },

    async downloadBundle(companyId: string): Promise<Blob> {
        const res = await authFetch(`/verify/companies/${companyId}/bundle-url`, {
            headers: { Accept: 'application/pdf' },
        });
        return res.blob();
    },

    async requestUpdate(companyId: string): Promise<{ ok: true }> {
        const res = await authFetch(`/verify/companies/${companyId}/request-update`, { method: 'POST' });
        return res.json();
    },

    async flagForReview(companyId: string): Promise<{ ok: true }> {
        const res = await authFetch(`/verify/companies/${companyId}/flag-review`, { method: 'POST' });
        return res.json();
    },

    async verifyCompany(companyId: string): Promise<{ ok: true; verifiedAt: string; status: string }> {
        const res = await authFetch(`/verify/companies/${companyId}/verify`, { method: 'POST' });
        return res.json();
    },

    async verifyDocument(documentId: string): Promise<{ ok: true; status: string; verifiedAt: string | null }> {
        const res = await authFetch(`/verify/documents/${documentId}/verify`, { method: 'POST' });
        return res.json();
    },

    async rejectDocument(documentId: string): Promise<{ ok: true }> {
        const res = await authFetch(`/verify/documents/${documentId}/reject`, { method: 'POST' });
        return res.json();
    },

    async getActivity(): Promise<EvaluatorActivity[]> {
        const res = await authFetch('/verify/activity');
        return res.json();
    },
};

export interface EvaluatorActivity {
    id: string;
    action: string;
    companyId: string | null;
    companyName: string | null;
    timestamp: string;
    outcome: string;
}
