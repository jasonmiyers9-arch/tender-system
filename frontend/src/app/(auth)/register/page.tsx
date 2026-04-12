'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { auth } from '@/lib/api/auth';
import { Input } from '@/components/ui/Input';
import { TENDER_CATEGORIES } from '@/lib/constants/tenderCategories';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        companyName: '',
        registrationNumber: '',
        phone: '',
        tenderCategory: '',
    });
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
        <div className="w-full max-w-md mx-auto px-4 sm:px-0">
            {/* Logo + heading */}
            <div className="flex flex-col items-center mb-8 gap-4">
                <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                >
                    <Shield size={26} color="white" strokeWidth={2} />
                </div>
                <div className="text-center space-y-1">
                    <h1 className="text-2xl font-bold text-[--color-text-primary] tracking-tight">Create your account</h1>
                    <p className="text-sm text-[--color-text-muted]">Get started with TenderGuard Pro</p>
                </div>
            </div>

            {/* Card */}
            <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] shadow-md overflow-hidden">
                {/* Colour-accent top stripe */}
                <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #4F46E5, #7C3AED, #3B82F6)' }} />

                <div className="px-8 pt-7 pb-8">
                    {/* Notice */}
                    {notice && (
                        <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25">
                            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium whitespace-pre-line">{notice}</p>
                        </div>
                    )}
                    {/* Error */}
                    {error && (
                        <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25">
                            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-red-700 dark:text-red-400 font-medium">{error}</p>
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleRegister}>
                        <Input
                            label="Full Name"
                            placeholder="e.g. Sipho Dlamini"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                        <Input
                            type="email"
                            label="Email Address"
                            placeholder="you@company.co.za"
                            required
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />

                        <Input
                            label="Company Name"
                            placeholder="e.g. Acme Infra (Pty) Ltd"
                            required
                            value={formData.companyName}
                            onChange={e => setFormData({ ...formData, companyName: e.target.value })}
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

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-[--color-text-primary]">Tender Category</label>
                            <input
                                list="tender-category-options"
                                className="w-full rounded-xl border border-[--color-border] bg-[--color-surface] px-3.5 py-2.5 text-sm text-[--color-text-primary] outline-none focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] transition-colors"
                                placeholder="Type a keyword (e.g. security, plumbing, software)..."
                                value={formData.tenderCategory}
                                onChange={e => setFormData({ ...formData, tenderCategory: e.target.value })}
                                required
                            />
                            <datalist id="tender-category-options">
                                {TENDER_CATEGORIES.map((category) => (
                                    <option key={category} value={category} />
                                ))}
                            </datalist>
                            <p className="text-xs text-[--color-text-muted]">Start typing to see matching categories.</p>
                        </div>

                        <Input
                            type="password"
                            label="Password"
                            placeholder="••••••••"
                            hint="Must be at least 8 characters long."
                            required
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />

                        {/* Primary CTA */}
                        <div className="pt-1">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity duration-150 disabled:opacity-70 disabled:cursor-not-allowed"
                                style={{
                                    background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                                    boxShadow: '0 4px 16px rgba(79,70,229,0.35)',
                                }}
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        Creating account...
                                    </>
                                ) : 'Create Account'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 pt-6 border-t border-[--color-border] text-center">
                        <p className="text-sm text-[--color-text-muted]">
                            Already have an account?{' '}
                            <Link href="/login" className="font-semibold text-[--color-primary] hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
