'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
    Globe,
    Play,
    Plus,
    Trash2,
    RefreshCw,
    Clock,
    CheckCircle2,
    AlertCircle,
    Search,
    Download,
    ExternalLink,
    ToggleLeft,
    ToggleRight,
    ChevronDown,
    Loader2,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface ScraperSource {
    name: string;
    enabled: boolean;
    baseUrl: string;
}

interface CustomSource {
    url: string;
    name: string;
    enabled: boolean;
}

interface ScrapeResult {
    source: string;
    totalScraped: number;
    newTenders: number;
    duplicatesSkipped: number;
    errors: string[];
    scrapedAt: string;
}

interface ScrapedTender {
    title: string;
    organization: string;
    category: string;
    description: string;
    deadline: string;
    advertised: string;
    value: string;
    location: string;
    referenceNumber: string;
    sourceUrl: string;
    sourceSite: string;
    rawCategory: string;
    scrapedAt: string;
}

interface ScraperStatus {
    sources: ScraperSource[];
    customSources: CustomSource[];
    totalScrapedTenders: number;
    history: ScrapeResult[];
    categories: string[];
}

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem('tenderguard-app-state');
    if (!raw) return null;
    try {
        return JSON.parse(raw)?.state?.token ?? null;
    } catch {
        return null;
    }
}

async function scraperFetch(path: string, init?: RequestInit) {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`/api/tenders/scrape${path}`, { ...init, headers });
}

export default function ScraperPage() {
    const currentUser = useAppStore(s => s.currentUser);
    const [status, setStatus] = useState<ScraperStatus | null>(null);
    const [tenders, setTenders] = useState<ScrapedTender[]>([]);
    const [loading, setLoading] = useState(false);
    const [scraping, setScraping] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [newSourceUrl, setNewSourceUrl] = useState('');
    const [newSourceName, setNewSourceName] = useState('');
    const [showAddSource, setShowAddSource] = useState(false);
    const [expandedTender, setExpandedTender] = useState<number | null>(null);

    const showMessage = useCallback((type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    }, []);

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await scraperFetch('');
            if (!res.ok) throw new Error('Failed to fetch scraper status');
            const data = await res.json();
            setStatus(data);
        } catch (err) {
            showMessage('error', err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [showMessage]);

    const fetchTenders = useCallback(async () => {
        try {
            const params = new URLSearchParams({ action: 'tenders', limit: '50' });
            if (searchQuery) params.set('search', searchQuery);
            if (selectedCategory) params.set('category', selectedCategory);
            const res = await scraperFetch(`?${params}`);
            if (!res.ok) throw new Error('Failed to fetch tenders');
            const data = await res.json();
            setTenders(data.tenders);
        } catch (err) {
            showMessage('error', err instanceof Error ? err.message : 'Failed to load tenders');
        }
    }, [searchQuery, selectedCategory, showMessage]);

    const runScrapeAll = async () => {
        setScraping(true);
        try {
            const res = await scraperFetch('', {
                method: 'POST',
                body: JSON.stringify({ action: 'scrape-all' }),
            });
            if (!res.ok) throw new Error('Scraping failed');
            const data = await res.json();
            showMessage('success', `Scraped ${data.results?.reduce((s: number, r: ScrapeResult) => s + r.newTenders, 0) ?? 0} new tenders from ${data.results?.length ?? 0} sources`);
            await fetchStatus();
            await fetchTenders();
        } catch (err) {
            showMessage('error', err instanceof Error ? err.message : 'Scraping failed');
        } finally {
            setScraping(false);
        }
    };

    const runScrapeSingle = async (sourceName: string) => {
        setScraping(true);
        try {
            const res = await scraperFetch('', {
                method: 'POST',
                body: JSON.stringify({ action: 'scrape-source', sourceName }),
            });
            if (!res.ok) throw new Error(`Scraping ${sourceName} failed`);
            const data = await res.json();
            showMessage('success', `${sourceName}: ${data.result?.newTenders ?? 0} new tenders`);
            await fetchStatus();
            await fetchTenders();
        } catch (err) {
            showMessage('error', err instanceof Error ? err.message : 'Scraping failed');
        } finally {
            setScraping(false);
        }
    };

    const addSource = async () => {
        if (!newSourceUrl || !newSourceName) return;
        try {
            const res = await scraperFetch('', {
                method: 'POST',
                body: JSON.stringify({ action: 'add-source', url: newSourceUrl, name: newSourceName }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to add source');
            }
            showMessage('success', `Added source: ${newSourceName}`);
            setNewSourceUrl('');
            setNewSourceName('');
            setShowAddSource(false);
            await fetchStatus();
        } catch (err) {
            showMessage('error', err instanceof Error ? err.message : 'Failed to add source');
        }
    };

    const removeSource = async (url: string) => {
        try {
            const res = await scraperFetch('', {
                method: 'POST',
                body: JSON.stringify({ action: 'remove-source', url }),
            });
            if (!res.ok) throw new Error('Failed to remove source');
            showMessage('success', 'Source removed');
            await fetchStatus();
        } catch (err) {
            showMessage('error', err instanceof Error ? err.message : 'Failed to remove');
        }
    };

    const toggleSource = async (name: string, enabled: boolean) => {
        try {
            const res = await scraperFetch('', {
                method: 'POST',
                body: JSON.stringify({ action: 'toggle-source', name, enabled }),
            });
            if (!res.ok) throw new Error('Failed to toggle source');
            await fetchStatus();
        } catch (err) {
            showMessage('error', err instanceof Error ? err.message : 'Failed to toggle');
        }
    };

    // Only admins can access
    if (currentUser?.role !== 'admin') {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <PageHeader
                    title="Tender Scraper"
                    subtitle="You need admin access to manage the scraper."
                    icon={<Globe size={22} />}
                    iconColor="#3B82F6"
                />
            </div>
        );
    }

    // Initial load
    if (!status && !loading) {
        fetchStatus();
        fetchTenders();
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <PageHeader
                title="Tender Scraper"
                subtitle="Scrape tenders from SA government websites and import them into the system."
                icon={<Globe size={22} />}
                iconColor="#3B82F6"
                actions={
                    <button
                        onClick={runScrapeAll}
                        disabled={scraping}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}
                    >
                        {scraping ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Scraping...
                            </>
                        ) : (
                            <>
                                <Play size={16} />
                                Scrape All Sources
                            </>
                        )}
                    </button>
                }
            />

            {/* Status message */}
            {message && (
                <div className={`flex items-center gap-2.5 p-3.5 rounded-xl border ${
                    message.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
                        : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25'
                }`}>
                    {message.type === 'success' ? (
                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    ) : (
                        <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                    )}
                    <p className={`text-sm font-medium ${
                        message.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                    }`}>{message.text}</p>
                </div>
            )}

            {/* Stats Row */}
            {status && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                                <Globe size={20} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[--color-text-primary]">{status.sources.length + status.customSources.length}</p>
                                <p className="text-xs text-[--color-text-muted]">Configured Sources</p>
                            </div>
                        </div>
                    </Card>
                    <Card>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                                <Download size={20} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[--color-text-primary]">{status.totalScrapedTenders}</p>
                                <p className="text-xs text-[--color-text-muted]">Scraped Tenders</p>
                            </div>
                        </div>
                    </Card>
                    <Card>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                                <Clock size={20} className="text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[--color-text-primary]">{status.history.length}</p>
                                <p className="text-xs text-[--color-text-muted]">Scrape Runs</p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Sources Management */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-[--color-text-primary]">Scraper Sources</h3>
                    <button
                        onClick={() => setShowAddSource(!showAddSource)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                    >
                        <Plus size={14} />
                        Add Custom Source
                    </button>
                </div>

                {/* Add Custom Source Form */}
                {showAddSource && (
                    <div className="mb-4 p-4 rounded-xl border border-[--color-border] bg-[--color-surface-alt] space-y-3">
                        <Input
                            label="Source Name"
                            placeholder="e.g. Provincial Tenders"
                            value={newSourceName}
                            onChange={e => setNewSourceName(e.target.value)}
                        />
                        <Input
                            label="URL"
                            placeholder="https://example.gov.za/tenders"
                            value={newSourceUrl}
                            onChange={e => setNewSourceUrl(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={addSource}
                                disabled={!newSourceUrl || !newSourceName}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                Add Source
                            </button>
                            <button
                                onClick={() => { setShowAddSource(false); setNewSourceUrl(''); setNewSourceName(''); }}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Built-in Sources */}
                <div className="space-y-2">
                    {status?.sources.map(source => (
                        <div key={source.name} className="flex items-center justify-between p-3 rounded-xl border border-[--color-border] bg-[--color-surface-alt]">
                            <div className="flex items-center gap-3">
                                <button onClick={() => toggleSource(source.name, !source.enabled)} className="flex-shrink-0">
                                    {source.enabled ? (
                                        <ToggleRight size={24} className="text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                        <ToggleLeft size={24} className="text-[--color-text-muted]" />
                                    )}
                                </button>
                                <div>
                                    <p className="text-sm font-semibold text-[--color-text-primary]">{source.name}</p>
                                    <p className="text-xs text-[--color-text-muted]">{source.baseUrl}</p>
                                </div>
                                <Badge variant={source.enabled ? 'success' : 'default'}>
                                    {source.enabled ? 'Active' : 'Disabled'}
                                </Badge>
                            </div>
                            <button
                                onClick={() => runScrapeSingle(source.name)}
                                disabled={scraping || !source.enabled}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                <RefreshCw size={12} className={scraping ? 'animate-spin' : ''} />
                                Scrape
                            </button>
                        </div>
                    ))}

                    {/* Custom Sources */}
                    {status?.customSources.map(source => (
                        <div key={source.url} className="flex items-center justify-between p-3 rounded-xl border border-dashed border-[--color-border] bg-[--color-surface-alt]">
                            <div className="flex items-center gap-3">
                                <button onClick={() => toggleSource(source.name, !source.enabled)} className="flex-shrink-0">
                                    {source.enabled ? (
                                        <ToggleRight size={24} className="text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                        <ToggleLeft size={24} className="text-[--color-text-muted]" />
                                    )}
                                </button>
                                <div>
                                    <p className="text-sm font-semibold text-[--color-text-primary]">{source.name}</p>
                                    <p className="text-xs text-[--color-text-muted]">{source.url}</p>
                                </div>
                                <Badge variant="accent">Custom</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => runScrapeSingle(source.name)}
                                    disabled={scraping || !source.enabled}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    <RefreshCw size={12} />
                                    Scrape
                                </button>
                                <button
                                    onClick={() => removeSource(source.url)}
                                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Scrape History */}
            {status?.history && status.history.length > 0 && (
                <Card>
                    <h3 className="text-base font-semibold text-[--color-text-primary] mb-3">Recent Scrape History</h3>
                    <div className="space-y-2">
                        {status.history.slice(0, 10).map((run, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-[--color-border] bg-[--color-surface-alt]">
                                <div className="flex items-center gap-3">
                                    {run.errors.length > 0 ? (
                                        <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
                                    ) : (
                                        <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium text-[--color-text-primary]">{run.source}</p>
                                        <p className="text-xs text-[--color-text-muted]">
                                            {new Date(run.scrapedAt).toLocaleString('en-ZA')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{run.newTenders} new</span>
                                    <span className="text-[--color-text-muted]">{run.duplicatesSkipped} dupes</span>
                                    <span className="text-[--color-text-muted]">{run.totalScraped} total</span>
                                    {run.errors.length > 0 && (
                                        <span className="text-amber-600 font-medium">{run.errors.length} errors</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Scraped Tenders */}
            <Card>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-base font-semibold text-[--color-text-primary]">Scraped Tenders</h3>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
                            <input
                                type="text"
                                placeholder="Search tenders..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchTenders()}
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[--color-border] bg-[--color-surface] text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={e => { setSelectedCategory(e.target.value); setTimeout(fetchTenders, 0); }}
                            className="rounded-lg border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm outline-none cursor-pointer"
                        >
                            <option value="">All Categories</option>
                            {status?.categories?.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {tenders.length === 0 ? (
                    <div className="text-center py-12 text-[--color-text-muted]">
                        <Globe size={40} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">No scraped tenders yet</p>
                        <p className="text-xs mt-1">Click &quot;Scrape All Sources&quot; to fetch tenders from configured websites</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {tenders.map((tender, idx) => (
                            <div key={idx} className="rounded-xl border border-[--color-border] bg-[--color-surface-alt] overflow-hidden">
                                <button
                                    onClick={() => setExpandedTender(expandedTender === idx ? null : idx)}
                                    className="w-full text-left p-3.5 flex items-start gap-3"
                                >
                                    <ChevronDown size={16} className={`mt-0.5 text-[--color-text-muted] flex-shrink-0 transition-transform ${expandedTender === idx ? 'rotate-180' : ''}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-semibold text-[--color-text-primary] line-clamp-2">{tender.title}</p>
                                            <Badge variant="accent" className="flex-shrink-0">{tender.category}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5 text-xs text-[--color-text-muted]">
                                            <span>{tender.organization}</span>
                                            {tender.deadline && <span>Closes: {tender.deadline}</span>}
                                            <span className="text-[--color-text-muted]/60">{tender.sourceSite}</span>
                                        </div>
                                    </div>
                                </button>

                                {expandedTender === idx && (
                                    <div className="px-3.5 pb-3.5 border-t border-[--color-border] pt-3 space-y-2">
                                        <p className="text-sm text-[--color-text-secondary] whitespace-pre-line">{tender.description}</p>
                                        <div className="flex flex-wrap gap-2 text-xs text-[--color-text-muted]">
                                            {tender.referenceNumber && <span>Ref: {tender.referenceNumber}</span>}
                                            <span>Advertised: {tender.advertised}</span>
                                            <span>Raw Category: {tender.rawCategory}</span>
                                        </div>
                                        {tender.sourceUrl && (
                                            <a
                                                href={tender.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                <ExternalLink size={12} />
                                                View on source site
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
