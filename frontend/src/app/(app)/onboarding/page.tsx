'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { companies } from '@/lib/api/companies';
import { useAppStore } from '@/store/useAppStore';

export default function OnboardingPage() {
    const router = useRouter();
    const { currentUser, setCurrentUser } = useAppStore();
    const [form, setForm] = useState({
        csd_number: '',
        bbbee_level: '',
        cidb_grade: '',
        industry_sector: '',
        province: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<null | { onboardingCompleted: boolean; checks: Record<string, boolean>; completionPercent: number; documentsUploaded: number; requiredDocuments: number }>(null);

    useEffect(() => {
        companies.onboardingStatus().then((s) => {
            setStatus(s);
            if (s.onboardingCompleted) {
                if (currentUser) setCurrentUser({ ...currentUser, onboardingCompleted: true });
                router.push('/dashboard');
            }
        }).catch(() => undefined);
    }, [router, currentUser, setCurrentUser]);

    const checklist = useMemo(() => {
        if (!status) return [] as Array<{ label: string; done: boolean }>;
        return [
            { label: 'CSD Number captured', done: !!status.checks?.csd_number },
            { label: 'B-BBEE Level captured', done: !!status.checks?.bbbee_level },
            { label: 'Industry Sector captured', done: !!status.checks?.industry_sector },
            { label: 'Province captured', done: !!status.checks?.province },
            { label: `At least ${status.requiredDocuments} documents uploaded`, done: !!status.checks?.minimum_documents_uploaded },
        ];
    }, [status]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const result = await companies.completeOnboarding(form);
            const latest = await companies.onboardingStatus();
            setStatus(latest);
            if (currentUser) {
                setCurrentUser({ ...currentUser, onboardingCompleted: !!result.onboardingCompleted });
            }
            if (result.onboardingCompleted) {
                router.push('/dashboard');
            } else {
                router.push('/vault?onboarding=1');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[--color-text-primary]">Company Setup</h1>
                <p className="text-sm text-[--color-text-muted] mt-1">
                    Complete onboarding to unlock your full tender readiness workflow.
                </p>
            </div>

            {status && (
                <Card>
                    <p className="text-sm font-semibold text-[--color-text-primary]">Onboarding progress: {status.completionPercent}%</p>
                    <p className="text-xs text-[--color-text-muted] mt-1">Documents uploaded: {status.documentsUploaded}/{status.requiredDocuments}</p>
                    <ul className="mt-3 space-y-1">
                        {checklist.map((item) => (
                            <li key={item.label} className={`text-xs ${item.done ? 'text-green-600' : 'text-[--color-text-muted]'}`}>
                                {item.done ? '✓' : '•'} {item.label}
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            <Card>
                <form className="space-y-4" onSubmit={onSubmit}>
                    {error && <div className="p-3 rounded bg-red-50 text-red-700 text-xs border border-red-200">{error}</div>}

                    <Input label="CSD Number" required value={form.csd_number} onChange={(e) => setForm({ ...form, csd_number: e.target.value })} />
                    <Input label="B-BBEE Level" required value={form.bbbee_level} onChange={(e) => setForm({ ...form, bbbee_level: e.target.value })} />
                    <Input label="CIDB Grade (if applicable)" value={form.cidb_grade} onChange={(e) => setForm({ ...form, cidb_grade: e.target.value })} />
                    <Input label="Industry Sector" required value={form.industry_sector} onChange={(e) => setForm({ ...form, industry_sector: e.target.value })} />
                    <Input label="Province" required value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />

                    <div className="p-3 rounded border border-amber-300 bg-amber-50 text-xs text-amber-800">
                        Next step: upload your first 3 priority documents in Vault — B-BBEE certificate, SARS TCS Pin, and CIPC registration certificate.
                    </div>

                    <div className="flex justify-end">
                        <Button type="submit" loading={loading}>Save & Continue</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
