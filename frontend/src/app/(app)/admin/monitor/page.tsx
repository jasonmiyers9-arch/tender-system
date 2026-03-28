'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { Activity } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

type StatusResponse = {
    frontend_url: string;
    reachable: boolean;
    status_code: number | null;
    latency_ms: number | null;
    probe_error: string | null;
    checked_at: string;
    last_heartbeat: {
        at: string | null;
        route: string | null;
        user_agent: string | null;
        build_id: string | null;
        seconds_since: number | null;
    };
    events_count: number;
};

type EventItem = {
    timestamp: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    route: string;
    stack?: string | null;
};

export default function AdminMonitorPage() {
    const role = useAppStore((s) => s.currentUser?.role);
    const [status, setStatus] = useState<StatusResponse | null>(null);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (role !== 'admin') return;

        const load = async () => {
            try {
                const [sRes, eRes] = await Promise.all([
                    fetch(`${API_BASE}/ops/frontend/status`, { cache: 'no-store' }),
                    fetch(`${API_BASE}/ops/frontend/events?limit=20`, { cache: 'no-store' }),
                ]);

                if (!sRes.ok) throw new Error(`Status failed (${sRes.status})`);
                if (!eRes.ok) throw new Error(`Events failed (${eRes.status})`);

                const sJson = (await sRes.json()) as StatusResponse;
                const eJson = (await eRes.json()) as { items: EventItem[] };

                setStatus(sJson);
                setEvents(eJson.items ?? []);
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load monitor');
            }
        };

        load();
        const timer = setInterval(load, 10000);
        return () => clearInterval(timer);
    }, [role]);

    // role is undefined while the store is hydrating — wait before blocking access.
    if (role === undefined || role === null) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="w-8 h-8 border-2 border-[--color-primary] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (role !== 'admin') {
        return (
            <div className="max-w-3xl mx-auto">
                <Card>
                    <h1 className="text-lg font-semibold text-[--color-text-primary]">Access denied</h1>
                    <p className="text-sm text-[--color-text-muted] mt-1">Admin role required for frontend monitoring.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader
                title="Frontend Monitor"
                subtitle="Live visibility from backend on frontend reachability and heartbeat."
                icon={<Activity size={22} />}
                iconColor="#10B981"
            />

            {error && (
                <Card>
                    <p className="text-sm text-[--color-danger]">{error}</p>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-[--color-text-muted]">Frontend Reachability</p>
                        <Badge variant={status?.reachable ? 'success' : 'danger'} size="sm">
                            {status?.reachable ? 'UP' : 'DOWN'}
                        </Badge>
                    </div>
                    <p className="mt-2 text-sm text-[--color-text-primary]">URL: {status?.frontend_url ?? '—'}</p>
                    <p className="text-sm text-[--color-text-primary]">HTTP: {status?.status_code ?? '—'}</p>
                    <p className="text-sm text-[--color-text-primary]">Latency: {status?.latency_ms ?? '—'} ms</p>
                </Card>

                <Card>
                    <p className="text-sm text-[--color-text-muted]">Last Frontend Heartbeat</p>
                    <p className="mt-2 text-sm text-[--color-text-primary]">At: {status?.last_heartbeat.at ?? '—'}</p>
                    <p className="text-sm text-[--color-text-primary]">Route: {status?.last_heartbeat.route ?? '—'}</p>
                    <p className="text-sm text-[--color-text-primary]">Age: {status?.last_heartbeat.seconds_since ?? '—'}s</p>
                </Card>
            </div>

            <Card>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-[--color-text-primary]">Frontend Events</h2>
                    <span className="text-xs text-[--color-text-muted]">{status?.events_count ?? 0} captured</span>
                </div>
                {events.length === 0 ? (
                    <p className="text-sm text-[--color-text-muted]">No frontend events captured yet.</p>
                ) : (
                    <ul className="space-y-2">
                        {events.map((evt, idx) => (
                            <li key={`${evt.timestamp}-${idx}`} className="p-3 rounded-lg border border-[--color-border] bg-[--color-bg]">
                                <div className="flex items-center justify-between gap-2">
                                    <Badge variant={evt.level === 'error' ? 'danger' : evt.level === 'warning' ? 'warning' : 'default'} size="sm">
                                        {evt.level.toUpperCase()}
                                    </Badge>
                                    <span className="text-xs text-[--color-text-muted]">{evt.timestamp}</span>
                                </div>
                                <p className="text-sm text-[--color-text-primary] mt-2">{evt.message}</p>
                                <p className="text-xs text-[--color-text-muted] mt-1">Route: {evt.route}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}
