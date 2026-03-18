'use client';

import { useEffect, useState } from 'react';
import { useActiveCompany, useUpdateCompanyProfile } from '@/lib/hooks/useCompanies';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Building2, Save } from 'lucide-react';

export default function CompanyProfilePage() {
    const { data: company, isLoading, isError, refetch } = useActiveCompany();
    const updateMutation = useUpdateCompanyProfile();
    const [saved, setSaved] = useState(false);
    const [form, setForm] = useState({
        name: '',
        registrationNumber: '',
        vatNumber: '',
        industry: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        incorporatedDate: '',
    });

    useEffect(() => {
        if (!company) return;
        setForm({
            name: company.name || '',
            registrationNumber: company.registrationNumber || '',
            vatNumber: company.vatNumber || '',
            industry: company.industry || '',
            email: company.email || '',
            phone: company.phone || '',
            website: company.website || '',
            address: company.address || '',
            incorporatedDate: company.incorporatedDate || '',
        });
    }, [company]);

    const setField = (key: keyof typeof form, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!company) return;
        await updateMutation.mutateAsync({
            name: form.name,
            registrationNumber: form.registrationNumber,
            vatNumber: form.vatNumber,
            industry: form.industry,
            email: form.email,
            phone: form.phone,
            address: form.address,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        refetch();
    };

    if (isLoading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
    if (isError || !company) return <ErrorState onRetry={refetch} />;

    return (
        <div key={company.id} className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">Company Profile</h1>
                    <p className="text-sm text-[--color-text-muted] mt-0.5">
                        Manage your entity&apos;s registration and contact details
                    </p>
                </div>
                <Badge
                    variant={company.status === 'verified' ? 'success' : company.status === 'rejected' ? 'danger' : 'warning'}
                    dot
                >
                    {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                </Badge>
            </div>

            <Card
                header={
                    <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-[--color-primary]" />
                        <h3 className="text-sm font-semibold text-[--color-text-primary]">Entity Identity</h3>
                    </div>
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input label="Company Name" value={form.name} onChange={(e) => setField('name', e.target.value)} />
                    <Input label="CIPC Registration Number" value={form.registrationNumber} onChange={(e) => setField('registrationNumber', e.target.value)} />
                    <Input label="VAT Number" value={form.vatNumber} onChange={(e) => setField('vatNumber', e.target.value)} />
                    <Input label="Industry" value={form.industry} onChange={(e) => setField('industry', e.target.value)} />
                    <Input label="Incorporation Date" type="date" value={form.incorporatedDate} onChange={(e) => setField('incorporatedDate', e.target.value)} />
                </div>
            </Card>

            <Card header={<h3 className="text-sm font-semibold text-[--color-text-primary]">Contact Information</h3>}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input label="Email Address" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
                    <Input label="Phone Number" type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                    <Input label="Website" value={form.website} onChange={(e) => setField('website', e.target.value)} />
                    <div className="md:col-span-2">
                        <Input label="Registered Address" value={form.address} onChange={(e) => setField('address', e.target.value)} />
                    </div>
                </div>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => refetch()}>Cancel</Button>
                <Button
                    onClick={handleSave}
                    loading={updateMutation.isPending}
                    leftIcon={<Save size={15} />}
                >
                    {saved ? 'Saved ✓' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
}
