'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Save, Building2, User } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const STORAGE_KEY = 'tenderguard-provider-profile';

export default function ProviderProfilePage() {
    const currentUser = useAppStore((s) => s.currentUser);
    const [saved, setSaved] = useState(false);
    const [form, setForm] = useState({
        organizationName: '',
        contactPerson: currentUser?.name ?? '',
        email: currentUser?.email ?? '',
        phone: '',
        providerType: '',
        location: 'South Africa',
        address: '',
        description: '',
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            setForm((prev) => ({
                ...prev,
                ...parsed,
                contactPerson: parsed.contactPerson || currentUser?.name || prev.contactPerson,
                email: parsed.email || currentUser?.email || prev.email,
            }));
        } catch {
            // ignore invalid local profile data
        }
    }, [currentUser?.email, currentUser?.name]);

    const setField = (key: keyof typeof form, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">Provider Profile</h1>
                    <p className="text-sm text-[--color-text-muted] mt-0.5">
                        Set the identity and contact details used by the tender provider portal.
                    </p>
                </div>
                <Badge variant="accent" dot>Tender Provider</Badge>
            </div>

            <Card
                header={
                    <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-[--color-primary]" />
                        <h3 className="text-sm font-semibold text-[--color-text-primary]">Organization Details</h3>
                    </div>
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input label="Organization Name" value={form.organizationName} onChange={(e) => setField('organizationName', e.target.value)} />
                    <Input label="Provider Type" value={form.providerType} onChange={(e) => setField('providerType', e.target.value)} />
                    <Input label="Location" value={form.location} onChange={(e) => setField('location', e.target.value)} />
                    <div className="md:col-span-2">
                        <Input label="Address" value={form.address} onChange={(e) => setField('address', e.target.value)} />
                    </div>
                </div>
            </Card>

            <Card
                header={
                    <div className="flex items-center gap-2">
                        <User size={16} className="text-[--color-primary]" />
                        <h3 className="text-sm font-semibold text-[--color-text-primary]">Contact Details</h3>
                    </div>
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input label="Contact Person" value={form.contactPerson} onChange={(e) => setField('contactPerson', e.target.value)} />
                    <Input label="Email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
                    <Input label="Phone Number" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                    <div className="md:col-span-2 space-y-1.5">
                        <label className="text-sm font-medium text-[--color-text-primary]">Description</label>
                        <textarea
                            className="w-full rounded-lg border border-[--color-border] bg-[--color-surface] px-3 py-2.5 text-sm text-[--color-text-primary] outline-none min-h-[110px]"
                            value={form.description}
                            onChange={(e) => setField('description', e.target.value)}
                        />
                    </div>
                </div>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} leftIcon={<Save size={15} />}>
                    {saved ? 'Saved ✓' : 'Save Provider Profile'}
                </Button>
            </div>
        </div>
    );
}
