'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Save, Settings } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

export default function SettingsPage() {
    const [timezone, setTimezone] = useState('Africa/Johannesburg');
    const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const raw = window.localStorage.getItem('tenderguard-settings');
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw) as { timezone?: string; dateFormat?: string };
            if (parsed.timezone) setTimezone(parsed.timezone);
            if (parsed.dateFormat) setDateFormat(parsed.dateFormat);
        } catch {
            window.localStorage.removeItem('tenderguard-settings');
        }
    }, []);

    function saveSettings() {
        window.localStorage.setItem('tenderguard-settings', JSON.stringify({ timezone, dateFormat }));
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2500);
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                title="System Settings"
                subtitle="Manage application preferences and configurations."
                icon={<Settings size={22} />}
                iconColor="#6366F1"
            />

            <Card header={<h3 className="font-semibold text-sm">General Preferences</h3>}>
                <div className="space-y-5">
                    <Select
                        label="Timezone"
                        options={[
                            { value: 'Africa/Johannesburg', label: 'South Africa Standard Time (SAST)' },
                            { value: 'UTC', label: 'Coordinated Universal Time (UTC)' }
                        ]}
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                    />
                    <Select
                        label="Date Format"
                        options={[
                            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 30/12/2025)' },
                            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2025-12-30)' }
                        ]}
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value)}
                    />
                </div>
            </Card>

            <Card header={<h3 className="font-semibold text-sm">Notifications</h3>}>
                <div className="space-y-4">
                    {['Email Reminders for Expiring Documents', 'Weekly Portfolio Digest', 'New Tender Matches', 'Audit Log Critical Alerts'].map((label, i) => (
                        <label key={i} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-[--color-bg] transition-colors">
                            <input type="checkbox" defaultChecked={i < 3} className="w-5 h-5 rounded border-[--color-border] text-[--color-primary] focus:ring-[--color-primary]" />
                            <span className="text-sm font-medium text-[--color-text-primary]">{label}</span>
                        </label>
                    ))}
                </div>
            </Card>

            <div className="flex justify-end pt-4">
                <div className="flex items-center gap-3">
                    {saved && <p className="text-sm text-[--color-success]">Settings saved locally.</p>}
                    <Button leftIcon={<Save size={16} />} onClick={saveSettings}>Save Settings</Button>
                </div>
            </div>
        </div>
    );
}
