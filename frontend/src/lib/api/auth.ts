import type { AuthUser, LoginResponse } from './types';
import {
    applyFirebaseEmailVerificationCode,
    confirmFirebasePasswordReset,
    getCurrentIdToken,
    isFirebaseClientConfigured,
    registerWithEmailPassword,
    sendFirebasePasswordReset,
    signInWithEmailPassword,
    signInWithGooglePopup,
} from '@/lib/firebaseClient';
import { resolveApiBase } from './base';

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

const API_BASE = resolveApiBase();

export type AdminMfaChallenge = {
    mfaRequired: true;
    setupRequired: boolean;
    secret?: string;
    otpauthUrl?: string;
    message: string;
};

async function loginForPortal(
    path: string,
    email: string,
    password: string,
    totpCode?: string
): Promise<LoginResponse | AdminMfaChallenge> {
    const body = isFirebaseClientConfigured()
        ? { idToken: (await signInWithEmailPassword(email, password)).idToken, totpCode }
        : { email, password, totpCode };
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if ((res.status === 401 || res.status === 403) && path.includes('/auth/admin/login')) {
        const challenge = await res.json().catch(() => null);
        if (challenge?.mfaRequired) return challenge as AdminMfaChallenge;
        if (challenge?.detail === 'invalid_mfa_code') throw new Error('invalid_mfa_code');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Login failed' }));
        throw new Error(err.detail ?? 'Login failed');
    }

    return res.json();
}

export const auth = {
    async me(): Promise<AuthUser> {
        const token = (await getCurrentIdToken()) ?? getToken();
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
        return loginForPortal('/auth/login', email, password) as Promise<LoginResponse>;
    },

    async adminLogin(email: string, password: string, totpCode?: string): Promise<LoginResponse | AdminMfaChallenge> {
        return loginForPortal('/auth/admin/login', email, password, totpCode);
    },

    async googleSignIn(): Promise<LoginResponse> {
        if (typeof window === 'undefined') {
            throw new Error('Google sign-in is only available in the browser.');
        }

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
        role: 'company' | 'tender_provider';
        companyName: string;
        registrationNumber?: string;
        phone?: string;
        tenderCategories?: string[];
    }): Promise<{ status: string; message: string; verifyLink?: string | null; user: AuthUser; token?: string }> {
        const payload = {
            name: data.name,
            email: data.email,
            password: data.password,
            role: data.role,
            company_name: data.companyName,
            registration_number: data.registrationNumber,
            phone: data.phone,
            tender_categories: data.tenderCategories,
        };

        const res = isFirebaseClientConfigured()
            ? await (async () => {
                const { idToken } = await registerWithEmailPassword({
                    email: data.email,
                    password: data.password,
                    fullName: data.name,
                });
                return fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...payload, idToken }),
                });
            })()
            : await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
            throw new Error(err.detail ?? 'Registration failed');
        }

        return res.json();
    },

    async updateProfile(name: string): Promise<AuthUser> {
        const token = (await getCurrentIdToken(true)) ?? getToken();
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
        await applyFirebaseEmailVerificationCode(token);
        return { ok: true };
    },

    async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
        await sendFirebasePasswordReset(email);
        return { success: true, message: 'Password reset email sent.' };
    },

    async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
        await confirmFirebasePasswordReset(token, password);
        return { success: true, message: 'Password reset successful.' };
    },
};
