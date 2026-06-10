'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { companies } from '@/lib/api/companies';
import { useAppStore } from '@/store/useAppStore';
import { Building2, CheckCircle2, Circle, AlertCircle, ArrowRight, FolderLock } from 'lucide-react';

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
    const [status, setStatus] = useState<null | {
        onboardingCompleted: boolean;
        checks: Record<string, boolean>;
        completionPercent: number;
        documentsUploaded: number;
        requiredDocuments: number;
        priorityDocuments?: Array<{ category: string; label: string; uploaded: boolean }>;
    }>(null);

    useEffect(() => {
        let cancelled = false;

        const loadStatus = () => {
            companies.onboardingStatus().then((s) => {
                if (cancelled) return;
                setStatus(s);
                if (s.onboardingCompleted) {
                    if (currentUser) setCurrentUser({ ...currentUser, onboardingCompleted: true });
                    router.push('/home');
                }
            }).catch(() => undefined);
        };

        loadStatus();
        const timer = setInterval(loadStatus, 3000);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [router, currentUser, setCurrentUser]);

    const checklist = useMemo(() => {
        if (!status) return [] as Array<{ label: string; done: boolean }>;
        return [
            { label: 'CSD Number captured', done: !!status.checks?.csd_number },
            { label: 'B-BBEE Level captured', done: !!status.checks?.bbbee_level },
            { label: 'Industry Sector captured', done: !!status.checks?.industry_sector },
            { label: 'Province captured', done: !!status.checks?.province },
            { label: 'B-BBEE certificate uploaded', done: !!status.checks?.bbbee_certificate },
            { label: 'SARS TCS Pin uploaded', done: !!status.checks?.sars_pin },
            { label: 'CIPC registration certificate uploaded', done: !!status.checks?.cipc_registration },
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
                router.push('/home');
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
            <PageHeader
                title="Company Setup"
                subtitle="Complete your profile and upload the three priority documents before entering the workspace."
                icon={<Building2 size={22} />}
            />

            {/* Progress card */}
            {status && (
                <Card accent>
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-[--color-text-primary]">Onboarding Progress</p>
                        <span
                            className="text-xs font-bold px-3 py-1 rounded-full"
                            style={{
                                background: status.completionPercent >= 100 ? '#05966915' : '#4F46E515',
                                color: status.completionPercent >= 100 ? '#059669' : '#4F46E5',
                            }}
                        >
                            {status.completionPercent}%
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 w-full rounded-full bg-[--color-bg] overflow-hidden mb-4">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${status.completionPercent}%`,
                                background: status.completionPercent >= 100
                                    ? 'linear-gradient(90deg, #059669, #047857)'
                                    : 'linear-gradient(90deg, #4F46E5, #7C3AED)',
                            }}
                        />
                    </div>
                    <p className="text-xs text-[--color-text-muted] mb-3">
                        Priority documents uploaded: {status.documentsUploaded}/{status.requiredDocuments}
                    </p>
                    <ul className="space-y-2">
                        {checklist.map((item) => (
                            <li key={item.label} className="flex items-center gap-2.5 text-sm">
                                {item.done ? (
                                    <CheckCircle2 size={16} className="text-[--color-success] flex-shrink-0" />
                                ) : (
                                    <Circle size={16} className="text-[--color-text-muted] flex-shrink-0" />
                                )}
                                <span className={item.done ? 'text-[--color-text-primary] font-medium' : 'text-[--color-text-muted]'}>
                                    {item.label}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            {/* Form card */}
            <Card>
                <form className="space-y-4" onSubmit={onSubmit}>
                    {error && (
                        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                            <AlertCircle size={16} className="text-[--color-danger] flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-[--color-danger]">{error}</p>
                        </div>
                    )}

                    <Input label="CSD Number" required value={form.csd_number} onChange={(e) => setForm({ ...form, csd_number: e.target.value })} />
                    <Input label="B-BBEE Level" required value={form.bbbee_level} onChange={(e) => setForm({ ...form, bbbee_level: e.target.value })} />
                    <Input label="CIDB Grade (if applicable)" value={form.cidb_grade} onChange={(e) => setForm({ ...form, cidb_grade: e.target.value })} />
                    <Input label="Industry Sector" required value={form.industry_sector} onChange={(e) => setForm({ ...form, industry_sector: e.target.value })} />
                    <Input label="Province" required value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />

                    <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                        <FolderLock size={16} className="text-[--color-warning] flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-[--color-text-primary]">
                                Next: Upload priority documents
                            </p>
                            <p className="text-xs text-[--color-text-muted] mt-0.5">
                                Required before workspace access: B-BBEE certificate, SARS TCS Pin, and CIPC registration certificate.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                rightIcon={<ArrowRight size={13} />}
                                onClick={() => router.push('/vault?onboarding=1')}
                            >
                                Go to Vault Uploads
                            </Button>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button type="submit" loading={loading} rightIcon={<ArrowRight size={14} />}>
                            Save & Continue
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
