'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateTender } from '@/lib/hooks/useTenders';

const categoryOptions = [
    { value: 'tax', label: 'Tax' },
    { value: 'legal', label: 'Legal' },
    { value: 'financial', label: 'Financial' },
    { value: 'certification', label: 'Certification' },
    { value: 'bbbee', label: 'B-BBEE' },
    { value: 'registration', label: 'Registration' },
];

function normalizeDateInput(value: string): string {
    return value ? value.replace(/\//g, '-') : value;
}

const PROVIDER_PROFILE_KEY = 'tenderguard-provider-profile';

export default function NewProviderTenderPage() {
    const router = useRouter();
    const createTender = useCreateTender();
    const [form, setForm] = useState({
        title: '',
        organization: '',
        deadline: '',
        value: '',
        category: '',
        description: '',
        requirements: '',
        eligibilityCriteria: '',
        location: 'South Africa',
    });
    const [requiredCategories, setRequiredCategories] = useState<string[]>(['tax', 'registration']);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const raw = window.localStorage.getItem(PROVIDER_PROFILE_KEY);
        if (!raw) return;
        try {
            const profile = JSON.parse(raw);
            // Pre-fill form from saved profile - intentional pattern
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setForm((prev) => ({
                ...prev,
                organization: profile.organizationName || prev.organization,
                location: profile.location || prev.location,
            }));
        } catch {
            // ignore invalid provider profile data
        }
    }, []);

    const toggleCategory = (value: string) => {
        setRequiredCategories((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await createTender.mutateAsync({
                ...form,
                deadline: normalizeDateInput(form.deadline),
                requirements: form.requirements.split('\n').map((v) => v.trim()).filter(Boolean),
                eligibilityCriteria: form.eligibilityCriteria.split('\n').map((v) => v.trim()).filter(Boolean),
                required_categories: requiredCategories,
                status: 'published',
            });
            router.push('/provider/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create tender');
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-[--color-text-primary]">Upload Tender</h1>
                <p className="text-sm text-[--color-text-muted] mt-1">Create a tender in the provider portal and publish it to supplier company portals.</p>
            </div>

            <Card>
                <form className="space-y-5" onSubmit={handleSubmit}>
                    {error && <div className="p-3 rounded-xl bg-red-500/10 text-[--color-danger] text-xs border border-red-500/25">{error}</div>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Tender Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                        <Input label="Issuing Organization" required value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
                        <Input type="date" label="Deadline" required value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                        <Input label="Tender Value" required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
                        <Input label="Tender Category" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                        <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-[--color-text-primary]">Description</label>
                        <textarea className="w-full rounded-lg border border-[--color-border] bg-[--color-surface] px-3 py-2.5 text-sm text-[--color-text-primary] outline-none min-h-[110px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-[--color-text-primary]">Required Document Categories</label>
                        <div className="flex flex-wrap gap-2">
                            {categoryOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => toggleCategory(option.value)}
                                    className={`px-3 py-2 rounded-lg border text-sm ${requiredCategories.includes(option.value) ? 'bg-[#DBEAFE] border-[#93C5FD] text-[#1D4ED8]' : 'bg-[--color-surface] border-[--color-border] text-[--color-text-primary]'}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-[--color-text-primary]">Requirements (one per line)</label>
                            <textarea className="w-full rounded-lg border border-[--color-border] bg-[--color-surface] px-3 py-2.5 text-sm text-[--color-text-primary] outline-none min-h-[120px]" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-[--color-text-primary]">Eligibility Criteria (one per line)</label>
                            <textarea className="w-full rounded-lg border border-[--color-border] bg-[--color-surface] px-3 py-2.5 text-sm text-[--color-text-primary] outline-none min-h-[120px]" value={form.eligibilityCriteria} onChange={(e) => setForm({ ...form, eligibilityCriteria: e.target.value })} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => router.push('/provider/dashboard')}>Cancel</Button>
                        <Button type="submit" loading={createTender.isPending}>Publish Tender</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
