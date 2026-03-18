'use client';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Save } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-[--color-text-primary]">System Settings</h1>
                <p className="text-sm text-[--color-text-muted] mt-0.5">Manage application preferences and configurations.</p>
            </div>

            <Card header={<h3 className="font-semibold text-sm">General Preferences</h3>}>
                <div className="space-y-5">
                    <Select
                        label="Timezone"
                        options={[
                            { value: 'Africa/Johannesburg', label: 'South Africa Standard Time (SAST)' },
                            { value: 'UTC', label: 'Coordinated Universal Time (UTC)' }
                        ]}
                        value="Africa/Johannesburg"
                    />
                    <Select
                        label="Date Format"
                        options={[
                            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 30/12/2025)' },
                            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2025-12-30)' }
                        ]}
                        value="DD/MM/YYYY"
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
                <Button leftIcon={<Save size={16} />}>Save Settings</Button>
            </div>
        </div>
    );
}
