import type { Company } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

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
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
}

export const companies = {
    async listMyCompanies(): Promise<Company[]> {
        const json = await authFetch('/companies');
        return json.items ?? [];
    },

    async getActive(_id: string): Promise<Company> {
        return authFetch('/companies/active');
    },

    async switchActive(id: string): Promise<{ activeCompanyId: string }> {
        const json = await authFetch('/companies/switch', {
            method: 'POST',
            body: JSON.stringify({ company_id: Number(id) }),
        });
        return { activeCompanyId: json.activeCompanyId };
    },

    async updateProfile(_id: string, data: Partial<Company> & {
        csd_number?: string | null;
        bbbee_level?: string | null;
        cidb_grade?: string | null;
        province?: string | null;
    }): Promise<Company> {
        return authFetch('/companies/active', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    async onboardingStatus(): Promise<{ onboardingCompleted: boolean; companyId: string; checks: Record<string, boolean>; documentsUploaded: number; requiredDocuments: number; completionPercent: number }> {
        return authFetch('/companies/onboarding/status');
    },

    async completeOnboarding(payload: {
        csd_number?: string;
        bbbee_level?: string;
        cidb_grade?: string;
        industry_sector?: string;
        province?: string;
    }): Promise<{ ok: boolean; onboardingCompleted: boolean }> {
        return authFetch('/companies/onboarding', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
};
