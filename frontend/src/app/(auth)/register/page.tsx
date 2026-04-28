'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, CheckCircle2, AlertCircle, ChevronDown, X } from 'lucide-react';
import { auth } from '@/lib/api/auth';
import { Input } from '@/components/ui/Input';

const TENDER_CATEGORIES = [
  'Construction',
  'Infrastructure & Civil Works',
  'IT & Technology',
  'Professional Services',
  'Consulting',
  'Financial Services',
  'Healthcare & Medical',
  'Education & Training',
  'Transport & Logistics',
  'Security Services',
  'Cleaning & Waste Management',
  'Catering & Food Services',
  'Supplies: General',
  'Supplies: Computer Equipment',
  'Supplies: Electrical Equipment',
  'Supplies: Medical Equipment',
  'Agricultural & Farming',
  'Mining & Resources',
  'Energy & Power',
  'Water & Sanitation',
  'Telecommunications',
  'Legal Services',
  'Facilities Management',
  'Printing & Stationery',
  'Advertising & Media',
  'Research & Development',
  'Environmental Services',
  'Manufacturing',
  'Rental & Leasing',
  'Maintenance & Repairs',
  'Social Services',
  'Tourism & Hospitality',
  'Engineering Services',
  'Other',
] as const;

export default function RegisterPage() {
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'company' as 'company' | 'tender_provider', companyName: '', registrationNumber: '', phone: '', tenderCategories: [] as string[] });
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [flowMessage, setFlowMessage] = useState('');
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const progressTimerRef = useRef<number | null>(null);
    const router = useRouter();

    useEffect(() => {
        return () => {
            if (progressTimerRef.current) {
                window.clearInterval(progressTimerRef.current);
            }
        };
    }, []);

    const stopProgressTicker = () => {
        if (progressTimerRef.current) {
            window.clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
        }
    };

    const startProgressTicker = () => {
        stopProgressTicker();
        progressTimerRef.current = window.setInterval(() => {
            setProgress((current) => {
                if (current >= 85) return current;
                const increment = Math.floor(Math.random() * 7) + 2;
                return Math.min(85, current + increment);
            });
        }, 260);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setProgress(10);
        setFlowMessage('Validating your details...');
        setNotice(null);
        setError(null);

        if (formData.password.trim().length < 8) {
            setError('Password must be at least 8 characters long.');
            setLoading(false);
            setProgress(0);
            setFlowMessage('');
            return;
        }

        if (!formData.companyName.trim() || !formData.registrationNumber.trim() || !formData.phone.trim()) {
            setError('Please complete company name, registration number and phone number.');
            setLoading(false);
            setProgress(0);
            setFlowMessage('');
            return;
        }

        startProgressTicker();

        try {
            setFlowMessage('Creating your account...');
            const res = await auth.register({ ...formData, tenderCategories: formData.tenderCategories });
            stopProgressTicker();
            setFlowMessage('Finalizing your workspace...');
            setProgress(96);

            setNotice(res.message || 'Account created successfully. You can now sign in.');

            window.setTimeout(() => {
                setProgress(100);
                setFlowMessage('Account ready. Redirecting to sign in...');
                router.push('/login');
            }, 800);
        } catch (e) {
            stopProgressTicker();
            setProgress(0);
            setFlowMessage('');
            setError(e instanceof Error ? e.message : 'Registration failed');
        } finally {
            window.setTimeout(() => {
                setLoading(false);
            }, 900);
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

                    {/* Registration flow progress */}
                    {loading && (
                        <div className="mb-5 rounded-xl border border-[--color-border] bg-[--color-surface-alt] p-3.5">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-semibold text-[--color-text-primary]">Creating your account</p>
                                <p className="text-xs font-semibold text-[--color-text-muted]">{Math.round(progress)}%</p>
                            </div>
                            <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-300 ease-out"
                                    style={{
                                        width: `${progress}%`,
                                        background: 'linear-gradient(90deg, #4F46E5, #7C3AED, #3B82F6)',
                                    }}
                                />
                            </div>
                            {flowMessage && <p className="mt-2 text-xs text-[--color-text-muted]">{flowMessage}</p>}
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

                        {/* Account type select */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-[--color-text-primary]">Account Type</label>
                            <select
                                className="w-full rounded-xl border border-[--color-border] bg-[--color-surface] px-3.5 py-2.5 text-sm text-[--color-text-primary] outline-none focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] transition-colors cursor-pointer"
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value as 'company' | 'tender_provider' })}
                            >
                                <option value="company">Company</option>
                                <option value="tender_provider">Tender Provider</option>
                            </select>
                        </div>

                        <>
                            <Input
                                label={formData.role === 'tender_provider' ? 'Organisation Name' : 'Company Name'}
                                placeholder={formData.role === 'tender_provider' ? 'e.g. City Infrastructure Dept' : 'e.g. Acme Infra (Pty) Ltd'}
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
                        </>

                        {/* Tender Categories — multi-select */}
                        {formData.role === 'company' && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-[--color-text-primary]">
                                    Tender Categories of Interest
                                    <span className="ml-1 text-xs font-normal text-[--color-text-muted]">(select all that apply)</span>
                                </label>

                                {/* Selected tags */}
                                {formData.tenderCategories.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                                        {formData.tenderCategories.map(cat => (
                                            <span key={cat} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25">
                                                {cat}
                                                <button type="button" onClick={() => setFormData({ ...formData, tenderCategories: formData.tenderCategories.filter(c => c !== cat) })} className="hover:text-red-500 transition-colors">
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                                        className="w-full flex items-center justify-between rounded-xl border border-[--color-border] bg-[--color-surface] px-3.5 py-2.5 text-sm text-[--color-text-primary] outline-none focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] transition-colors cursor-pointer"
                                    >
                                        <span className={formData.tenderCategories.length === 0 ? 'text-[--color-text-muted]' : ''}>
                                            {formData.tenderCategories.length === 0 ? 'Select categories...' : `${formData.tenderCategories.length} selected`}
                                        </span>
                                        <ChevronDown size={16} className={`text-[--color-text-muted] transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {categoryDropdownOpen && (
                                        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[--color-border] bg-[--color-surface] shadow-xl max-h-52 overflow-y-auto">
                                            {TENDER_CATEGORIES.map(cat => {
                                                const selected = formData.tenderCategories.includes(cat);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={cat}
                                                        onClick={() => {
                                                            setFormData({
                                                                ...formData,
                                                                tenderCategories: selected
                                                                    ? formData.tenderCategories.filter(c => c !== cat)
                                                                    : [...formData.tenderCategories, cat],
                                                            });
                                                        }}
                                                        className={`w-full text-left px-3.5 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors flex items-center gap-2 ${
                                                            selected ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-[--color-text-primary]'
                                                        }`}
                                                    >
                                                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                                            selected ? 'bg-indigo-600 border-indigo-600' : 'border-[--color-border]'
                                                        }`}>
                                                            {selected && <CheckCircle2 size={12} className="text-white" />}
                                                        </span>
                                                        {cat}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

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
