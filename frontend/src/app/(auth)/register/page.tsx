'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { auth } from '@/lib/api/auth';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function RegisterPage() {
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'company' as 'admin' | 'company' | 'tender_provider', companyName: '', registrationNumber: '', phone: '' });
    const needsOrganisationFields = formData.role !== 'admin';
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setNotice(null);
        setError(null);
        try {
            const res = await auth.register(formData);
            setNotice(res.message || 'Account created successfully. You can now sign in.');
            setTimeout(() => router.push('/login'), 2500);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto relative px-4 sm:px-0">
            <div className="flex flex-col items-center mb-8">
                <div className="w-12 h-12 rounded-xl bg-[--color-primary] flex items-center justify-center flex-shrink-0 mb-3 shadow-md">
                    <Shield size={24} className="text-[--color-text-primary]" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[--color-text-primary]">Create your account</h1>
            </div>

            <Card padding="lg" className="shadow-lg border-opacity-60">
                <form className="space-y-4" onSubmit={handleRegister}>
                    {notice && <div className="p-3 rounded bg-green-50 text-green-700 text-xs border border-green-200 whitespace-pre-line">{notice}</div>}
                    {error && <div className="p-3 rounded bg-red-50 text-red-700 text-xs border border-red-200">{error}</div>}
                    <Input
                        label="Full Name"
                        placeholder="e.g. Sipho Dlamini"
                        required
                        value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                    <Input
                        type="email"
                        label="Email Address"
                        placeholder="you@company.co.za"
                        required
                        value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-[--color-text-primary]">Account Type</label>
                        <select
                            className="w-full rounded-lg border border-[--color-border] bg-[--color-surface] px-3 py-2.5 text-sm text-[--color-text-primary] outline-none"
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'company' | 'tender_provider' })}
                        >
                            <option value="company">Company</option>
                            <option value="tender_provider">Tender Provider</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    {needsOrganisationFields && (
                        <>
                            <Input
                                label={formData.role === 'tender_provider' ? 'Organisation Name' : 'Company Name'}
                                placeholder={formData.role === 'tender_provider' ? 'e.g. City Infrastructure Dept' : 'e.g. Acme Infra (Pty) Ltd'}
                                required
                                value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                            />
                            <Input
                                label="Registration Number"
                                placeholder="e.g. 2019/123456/07"
                                required
                                value={formData.registrationNumber}
                                onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })}
                            />
                            <Input
                                label="Phone Number"
                                placeholder="e.g. +27 82 000 0000"
                                required
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </>
                    )}
                    <Input
                        type="password"
                        label="Password"
                        placeholder="••••••••"
                        hint="Must be at least 8 characters long."
                        required
                        value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />

                    <Button type="submit" loading={loading} className="w-full h-11 mt-4 text-base">
                        Create Account
                    </Button>
                </form>

                <p className="text-center text-sm text-[--color-text-muted] mt-6">
                    Already have an account?{' '}
                    <Link href="/login" className="font-semibold text-[--color-primary] hover:underline">
                        Sign in
                    </Link>
                </p>
            </Card>
        </div>
    );
}
