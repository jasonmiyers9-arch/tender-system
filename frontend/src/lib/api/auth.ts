import type { AuthUser, LoginResponse } from './types';

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

const API_BASE = '/api';

export const auth = {
    async me(): Promise<AuthUser> {
        const token = getToken();
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: 'no-store',
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Session invalid' }));
            throw new Error(err.detail ?? 'Session invalid');
        }
        return res.json();
    },
    async login(email: string, password: string): Promise<LoginResponse> {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Login failed' }));
            throw new Error(err.detail ?? 'Login failed');
        }

        return res.json();
    },

    async googleSignIn(): Promise<LoginResponse> {
        if (typeof window === 'undefined') {
            throw new Error('Google sign-in is only available in the browser.');
        }

        const { signInWithGooglePopup } = await import('@/lib/firebaseClient');
        const { idToken } = await signInWithGooglePopup();

        const res = await fetch(`${API_BASE}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Google sign-in failed' }));
            throw new Error(err.detail ?? 'Google sign-in failed');
        }

        return res.json();
    },

    async register(data: {
        name: string;
        email: string;
        password: string;
        companyName: string;
        registrationNumber?: string;
        phone?: string;
    }): Promise<{ status: string; message: string; verifyLink?: string | null; user: AuthUser }> {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: data.name,
                email: data.email,
                password: data.password,
                role: 'company',
                company_name: data.companyName,
                registration_number: data.registrationNumber,
                phone: data.phone,
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
            throw new Error(err.detail ?? 'Registration failed');
        }

        return res.json();
    },

    async updateProfile(name: string): Promise<AuthUser> {
        const token = getToken();
        const res = await fetch(`${API_BASE}/auth/me`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ name }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Profile update failed' }));
            throw new Error(err.detail ?? 'Profile update failed');
        }
        return res.json();
    },

    async verifyEmail(token: string): Promise<{ ok: boolean }> {
        const res = await fetch(`${API_BASE}/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Email verification failed' }));
            throw new Error(err.detail ?? 'Email verification failed');
        }
        return res.json();
    },

    async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Request failed' }));
            throw new Error(err.detail ?? 'Request failed');
        }
        const data = await res.json();
        return { success: true, message: data.message };
    },

    async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Reset failed' }));
            throw new Error(err.detail ?? 'Reset failed');
        }
        const data = await res.json();
        return { success: true, message: data.message };
    },
};
