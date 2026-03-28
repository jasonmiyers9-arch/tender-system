import type { CompanySearchResult, CompanyComplianceReport } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

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
};
