'use client';

import { useEffect, useState } from 'react';
import { useActiveCompany, useUpdateCompanyProfile } from '@/lib/hooks/useCompanies';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Building2, Save, ShieldCheck } from 'lucide-react';

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
        // SA compliance fields
        csdNumber: '',
        bbbeeLevel: '',
        cidbGrade: '',
        province: '',
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
            csdNumber: company.csdNumber || '',
            bbbeeLevel: company.bbbeeLevel || '',
            cidbGrade: company.cidbGrade || '',
            province: company.province || '',
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
            // SA compliance fields (snake_case for backend)
            csd_number: form.csdNumber || null,
            bbbee_level: form.bbbeeLevel || null,
            cidb_grade: form.cidbGrade || null,
            province: form.province || null,
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

            <Card
                header={
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-[--color-primary]" />
                        <h3 className="text-sm font-semibold text-[--color-text-primary]">SA Compliance Details</h3>
                    </div>
                }
            >
                <p className="text-xs text-[--color-text-muted] mb-5">
                    Required for CSD supplier registration and tender eligibility verification.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input
                        label="CSD Supplier Number"
                        placeholder="e.g. MAAA0123456789"
                        value={form.csdNumber}
                        onChange={(e) => setField('csdNumber', e.target.value)}
                    />
                    <Select
                        label="B-BBEE Level"
                        value={form.bbbeeLevel}
                        onChange={(e) => setField('bbbeeLevel', e.target.value)}
                        options={[
                            { value: '', label: 'Select B-BBEE level…' },
                            { value: 'Level 1', label: 'Level 1 (110+ points)' },
                            { value: 'Level 2', label: 'Level 2 (105–109 points)' },
                            { value: 'Level 3', label: 'Level 3 (100–104 points)' },
                            { value: 'Level 4', label: 'Level 4 (95–99 points)' },
                            { value: 'Level 5', label: 'Level 5 (87–94 points)' },
                            { value: 'Level 6', label: 'Level 6 (75–86 points)' },
                            { value: 'Level 7', label: 'Level 7 (55–74 points)' },
                            { value: 'Level 8', label: 'Level 8 (below 55 points)' },
                            { value: 'Exempt', label: 'Exempt Micro Enterprise' },
                            { value: 'Non-compliant', label: 'Non-compliant' },
                        ]}
                    />
                    <Select
                        label="CIDB Grade"
                        value={form.cidbGrade}
                        onChange={(e) => setField('cidbGrade', e.target.value)}
                        options={[
                            { value: '', label: 'Select CIDB grade…' },
                            { value: '1', label: 'Grade 1 (up to R200k)' },
                            { value: '2', label: 'Grade 2 (up to R650k)' },
                            { value: '3', label: 'Grade 3 (up to R2m)' },
                            { value: '4', label: 'Grade 4 (up to R6.5m)' },
                            { value: '5', label: 'Grade 5 (up to R13m)' },
                            { value: '6', label: 'Grade 6 (up to R40m)' },
                            { value: '7', label: 'Grade 7 (up to R130m)' },
                            { value: '8', label: 'Grade 8 (up to R400m)' },
                            { value: '9', label: 'Grade 9 (over R400m)' },
                            { value: 'N/A', label: 'Not applicable' },
                        ]}
                    />
                    <Select
                        label="Province"
                        value={form.province}
                        onChange={(e) => setField('province', e.target.value)}
                        options={[
                            { value: '', label: 'Select province…' },
                            { value: 'Eastern Cape', label: 'Eastern Cape' },
                            { value: 'Free State', label: 'Free State' },
                            { value: 'Gauteng', label: 'Gauteng' },
                            { value: 'KwaZulu-Natal', label: 'KwaZulu-Natal' },
                            { value: 'Limpopo', label: 'Limpopo' },
                            { value: 'Mpumalanga', label: 'Mpumalanga' },
                            { value: 'Northern Cape', label: 'Northern Cape' },
                            { value: 'North West', label: 'North West' },
                            { value: 'Western Cape', label: 'Western Cape' },
                        ]}
                    />
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
