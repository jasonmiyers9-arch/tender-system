import { resolveApiBase } from './base';

const API_BASE = resolveApiBase();

export interface TenderApplication {
    id: string;
    tenderId: string;
    tenderTitle: string;
    tenderOrganization: string;
    tenderDeadline: string;
    tenderValue: string;
    providerEmail: string | null;
    companyId: number;
    companyName: string;
    appliedBy: string;
    appliedAt: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;
}

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

export interface CompanyDocument {
    id: string;
    name: string;
    category: string;
    status: string;
    expiryDate: string | null;
    uploadedAt: string | null;
}

export interface ApplicationCompanyDocuments {
    companyId: number;
    companyName: string;
    appliedBy: string;
    documents: CompanyDocument[];
}

export const applicationsApi = {
    async apply(tenderId: string): Promise<{ ok: boolean; application: TenderApplication }> {
        const res = await authFetch(`/tenders/${tenderId}/apply`, { method: 'POST' });
        return res.json();
    },

    async getMyApplicationForTender(tenderId: string): Promise<TenderApplication | null> {
        const res = await authFetch(`/companies/my-applications/${tenderId}`);
        return res.json();
    },

    async listMyApplications(): Promise<TenderApplication[]> {
        const res = await authFetch('/companies/my-applications');
        return res.json();
    },

    async listProviderApplications(): Promise<TenderApplication[]> {
        const res = await authFetch('/providers/applications');
        return res.json();
    },

    async approveApplication(appId: string): Promise<{ ok: boolean }> {
        const res = await authFetch(`/applications/${appId}/approve`, { method: 'POST' });
        return res.json();
    },

    async rejectApplication(appId: string, reason?: string): Promise<{ ok: boolean }> {
        const res = await authFetch(`/applications/${appId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
        return res.json();
    },

    async getApplicationCompanyDocuments(appId: string): Promise<ApplicationCompanyDocuments> {
        const res = await authFetch(`/applications/${appId}/company-documents`);
        return res.json();
    },

    async downloadDocument(appId: string, docId: string, filename: string): Promise<void> {
        const res = await authFetch(`/applications/${appId}/company-documents/${docId}/download`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
};



