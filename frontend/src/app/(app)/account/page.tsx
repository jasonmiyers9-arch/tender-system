'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Mail, Shield } from 'lucide-react';
import { auth } from '@/lib/api/auth';

export default function AccountProfilePage() {
    const { currentUser, setCurrentUser } = useAppStore();
    const [fullName, setFullName] = useState(currentUser?.name ?? '');
    const [phone, setPhone] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!currentUser) return null;

    const onSave = async () => {
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const updated = await auth.updateProfile(fullName);
            setCurrentUser(updated);
            setMessage('Profile saved successfully.');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-[--color-text-primary]">My Profile</h1>
                <p className="text-sm text-[--color-text-muted] mt-0.5">Manage your personal account details.</p>
            </div>

            <Card>
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center mb-6 pb-6 border-b border-[--color-border]">
                    <div className="w-20 h-20 rounded-full bg-[--color-bg] border border-[--color-border] flex items-center justify-center text-2xl font-bold text-[--color-primary] uppercase">
                        {currentUser.name.charAt(0)}
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-[--color-text-primary]">{currentUser.name}</h2>
                        <div className="flex items-center gap-2 text-sm text-[--color-text-muted]">
                            <Mail size={14} /> {currentUser.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[--color-text-muted] mt-1">
                            <Shield size={14} /> Role: <span className="capitalize font-medium text-[--color-text-primary]">{currentUser.role}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    <Input label="Email Address" type="email" value={currentUser.email} readOnly hint="Contact support to change email." />
                    <Input label="Phone Number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} hint="Local-only for now (not yet synced to backend)." />
                    <Input label="Job Title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} hint="Local-only for now (not yet synced to backend)." />
                </div>
            </Card>

            {error && <div className="p-3 rounded bg-[#FEE2E2] text-[#B91C1C] text-xs border border-[#FCA5A5]">{error}</div>}
            {message && <div className="p-3 rounded bg-[#DCFCE7] text-[#166534] text-xs border border-[#86EFAC]">{message}</div>}

            <div className="flex justify-end">
                <Button onClick={onSave} loading={saving}>Save Profile</Button>
            </div>
        </div>
    );
}
