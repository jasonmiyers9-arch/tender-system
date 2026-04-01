'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useProviderTenders, useUpdateTender } from '@/lib/hooks/useTenders';

const categoryOptions = [
    { value: 'tax', label: 'Tax' },
    { value: 'legal', label: 'Legal' },
    { value: 'financial', label: 'Financial' },
    { value: 'certification', label: 'Certification' },
    { value: 'bbbee', label: 'B-BBEE' },
    { value: 'registration', label: 'Registration' },
];

export default function EditTenderPage() {
    const router = useRouter();
    const params = useParams();
    const tenderId = params.id as string;
    const { data: tenders, isLoading } = useProviderTenders();
    const updateTender = useUpdateTender();

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
    const [requiredCategories, setRequiredCategories] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!tenders || loaded) return;
        const tender = tenders.find((t) => t.id === tenderId);
        if (!tender) return;
        setForm({
            title: tender.title,
            organization: tender.organization,
            deadline: tender.deadline,
            value: tender.value,
            category: tender.category,
            description: tender.description ?? '',
            requirements: (tender.requirements ?? []).join('\n'),
            eligibilityCriteria: (tender.eligibilityCriteria ?? []).join('\n'),
            location: tender.location,
        });
        setRequiredCategories(tender.required_categories ?? []);
        setLoaded(true);
    }, [tenders, tenderId, loaded]);

    const toggleCategory = (value: string) => {
        setRequiredCategories((prev) =>
            prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await updateTender.mutateAsync({
                id: tenderId,
                payload: {
                    ...form,
                    requirements: form.requirements.split('\n').map((v) => v.trim()).filter(Boolean),
                    eligibilityCriteria: form.eligibilityCriteria.split('\n').map((v) => v.trim()).filter(Boolean),
                    required_categories: requiredCategories,
                },
            });
            router.push('/provider/tenders');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update tender');
        }
    };

    if (isLoading) {
        return <div className="max-w-4xl mx-auto"><p className="text-sm text-[--color-text-muted]">Loading...</p></div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-[--color-text-primary]">Edit Tender</h1>
                <p className="text-sm text-[--color-text-muted] mt-1">Update this tender. It will require re-approval if it was previously published.</p>
            </div>

            <Card>
                <form className="space-y-5" onSubmit={handleSubmit}>
                    {error && <div className="p-3 rounded bg-[#FEE2E2] text-[#B91C1C] text-xs border border-[#FCA5A5]">{error}</div>}

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
                        <Button type="button" variant="ghost" onClick={() => router.push('/provider/tenders')}>Cancel</Button>
                        <Button type="submit" loading={updateTender.isPending}>Save Changes</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
