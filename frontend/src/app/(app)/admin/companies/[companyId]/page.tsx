'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Bell, Building2, CheckCircle, CheckCircle2, ChevronDown, Copy,
    Edit, FileText, KeyRound, Mail, ShieldCheck, ShieldOff, Shield, Sparkles,
    Users as UsersIcon, XCircle, AlertCircle,
} from 'lucide-react';
import {
    useAdminCompanies,
    useAdminCompanyDocuments,
    useAdminCompanyUsers,
    useAdminDownloadDocument,
    useAuditLog,
    useRejectDocument,
    useSendPasswordReset,
    useUpdateAdminCompany,
    useVerifyDocument,
} from '@/lib/hooks/useAdmin';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DownloadButton } from '@/components/ui/DownloadButton';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/badges/Badges';
import { fadeUp, T, stagger } from '@/lib/motion';
import { formatDate } from '@/lib/utils/formatters';
import type { Company, DocumentStatus } from '@/lib/api/types';

type Tab = 'overview' | 'members' | 'documents' | 'lifecycle';

const STATUS_TONE: Record<Company['status'], {
    label: string;
    dot: string;
    chip: string;
    chipText: string;
    avatar: string;
    glow: string;
}> = {
    verified: {
        label: 'Verified',
        dot: 'bg-emerald-500',
        chip: 'bg-emerald-500/10 border-emerald-500/30',
        chipText: 'text-emerald-600',
        avatar: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
        glow: 'rgba(16,185,129,0.45)',
    },
    pending: {
        label: 'Pending CIPC',
        dot: 'bg-amber-500',
        chip: 'bg-amber-500/10 border-amber-500/30',
        chipText: 'text-amber-600',
        avatar: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
        glow: 'rgba(245,158,11,0.45)',
    },
    rejected: {
        label: 'Suspended',
        dot: 'bg-red-500',
        chip: 'bg-red-500/10 border-red-500/30',
        chipText: 'text-red-600',
        avatar: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
        glow: 'rgba(239,68,68,0.45)',
    },
};

function initials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function relativeFromNow(iso?: string): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffMin = Math.round((Date.now() - then) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 30) return `${diffD}d ago`;
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

// ─── Overview form ───────────────────────────────────────────────────────────
function OverviewSection({ company, onSave, saving }: {
    company: Company;
    onSave: (payload: Partial<Company>) => void;
    saving: boolean;
}) {
    const getCompanyForm = () => ({
        name: company.name ?? '',
        registrationNumber: company.registrationNumber ?? '',
        vatNumber: company.vatNumber ?? '',
        industry: company.industry ?? '',
        province: company.province ?? '',
        bbbeeLevel: company.bbbeeLevel ?? '',
        cidbGrade: company.cidbGrade ?? '',
        csdNumber: company.csdNumber ?? '',
        email: company.email ?? '',
        phone: company.phone ?? '',
        website: company.website ?? '',
        address: company.address ?? '',
    });
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(getCompanyForm);

    const handleSave = () => {
        onSave(form);
        setEditing(false);
    };

    const handleCancel = () => {
        setForm(getCompanyForm());
        setEditing(false);
    };

    const field = (label: string, key: keyof typeof form, hint?: string) => (
        <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted] mb-1">{label}</p>
            {editing ? (
                <Input value={form[key]} onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))} hint={hint} />
            ) : (
                <p className="text-sm font-medium text-[--color-text-primary]">{company[key as keyof Company] ? String(company[key as keyof Company]) : <span className="text-[--color-text-muted] italic">—</span>}</p>
            )}
        </div>
    );

    return (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-5 card-shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4">
                <h3 className="text-sm font-bold text-[--color-text-primary]">Entity details</h3>
                {editing ? (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>Cancel</Button>
                        <Button size="sm" onClick={handleSave} loading={saving}>Save</Button>
                    </div>
                ) : (
                    <Button variant="ghost" size="sm" leftIcon={<Edit size={13} />} onClick={() => { setForm(getCompanyForm()); setEditing(true); }}>Edit</Button>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {field('Name', 'name')}
                {field('Registration No.', 'registrationNumber')}
                {field('VAT No.', 'vatNumber')}
                {field('Industry', 'industry')}
                {field('Province', 'province')}
                {field('B-BBEE level', 'bbbeeLevel', 'e.g. Level 2')}
                {field('CIDB grade', 'cidbGrade', 'e.g. 5GB')}
                {field('CSD number', 'csdNumber')}
                {field('Email', 'email')}
                {field('Phone', 'phone')}
                {field('Website', 'website')}
                <div className="sm:col-span-2 lg:col-span-3">{field('Address', 'address')}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-[--color-border]">
                <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted] mb-1">Incorporated</p>
                    <p className="text-sm text-[--color-text-primary]">{company.incorporatedDate ? formatDate(company.incorporatedDate) : <span className="text-[--color-text-muted] italic">—</span>}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted] mb-1">CIPC status</p>
                    <p className="text-sm text-[--color-text-primary] capitalize">{STATUS_TONE[company.status]?.label ?? company.status}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted] mb-1">Company ID</p>
                    <p className="text-xs font-mono text-[--color-text-muted] truncate">{company.id}</p>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Members section ─────────────────────────────────────────────────────────
function MembersSection({ companyId, onResetPassword, busyUserId }: {
    companyId: string;
    onResetPassword: (userId: string) => void;
    busyUserId: string | null;
}) {
    const usersQuery = useAdminCompanyUsers(companyId);
    const items = usersQuery.data?.items ?? [];

    return (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-5 card-shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                        <UsersIcon size={14} />
                    </div>
                    <h3 className="text-sm font-bold text-[--color-text-primary]">Members</h3>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted]">
                    {items.length} {items.length === 1 ? 'user' : 'users'}
                </span>
            </div>
            {usersQuery.isLoading ? (
                <p className="text-sm text-[--color-text-muted]">Loading members…</p>
            ) : usersQuery.isError ? (
                <p className="text-sm text-red-600">{(usersQuery.error as Error | null)?.message ?? 'Failed to load members'}</p>
            ) : items.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">No users linked to this company.</p>
            ) : (
                <motion.ul variants={stagger(0.04)} initial="hidden" animate="show" className="space-y-2">
                    {items.map((u) => (
                        <motion.li
                            key={u.id}
                            variants={fadeUp}
                            className="flex items-center gap-3 p-3 rounded-xl border border-[--color-border] hover:border-[--color-border-strong] transition-colors"
                        >
                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px]" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
                                {initials(u.name || u.email)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[--color-text-primary] truncate">{u.name || u.email}</p>
                                <p className="text-[11px] text-[--color-text-muted] truncate flex items-center gap-1">
                                    <Mail size={10} /> {u.email} · {u.role} · {u.verificationStatus}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onResetPassword(u.id)}
                                disabled={busyUserId === u.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-500/30 hover:bg-indigo-500/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <KeyRound size={12} /> {busyUserId === u.id ? 'Generating…' : 'Reset password'}
                            </button>
                        </motion.li>
                    ))}
                </motion.ul>
            )}
        </motion.div>
    );
}

// ─── Documents section ──────────────────────────────────────────────────────
function DocumentsSection({ companyId }: { companyId: string }) {
    const docsQuery = useAdminCompanyDocuments(companyId);
    const verifyDoc = useVerifyDocument();
    const rejectDoc = useRejectDocument();
    const downloadDoc = useAdminDownloadDocument();
    const docs = docsQuery.data?.items ?? [];

    return (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-5 card-shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <FileText size={14} />
                    </div>
                    <h3 className="text-sm font-bold text-[--color-text-primary]">Managed documents</h3>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted]">{docs.length}</span>
            </div>
            {docsQuery.isLoading ? (
                <p className="text-sm text-[--color-text-muted]">Loading documents…</p>
            ) : docs.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">No documents uploaded yet.</p>
            ) : (
                <motion.ul variants={stagger(0.04)} initial="hidden" animate="show" className="space-y-2">
                    {docs.map((doc) => (
                        <motion.li
                            key={doc.id}
                            variants={fadeUp}
                            className="flex items-center gap-3 p-3.5 rounded-xl border border-[--color-border] hover:border-[--color-border-strong] transition-colors"
                        >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/10 text-emerald-600">
                                <FileText size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[--color-text-primary] truncate">{doc.name}</p>
                                <p className="text-[11px] text-[--color-text-muted] mt-0.5">
                                    {doc.category} · expiry {formatDate(doc.expiryDate)}
                                </p>
                            </div>
                            <StatusBadge status={doc.status as DocumentStatus} />
                            <div className="flex items-center gap-1">
                                <DownloadButton
                                    ariaLabel="Download document"
                                    title="Download"
                                    size="sm"
                                    iconSize={14}
                                    className="px-2 py-1.5 rounded-md text-[--color-text-muted] hover:bg-[--color-bg] hover:text-indigo-600 border-transparent"
                                    onClick={() => downloadDoc.mutate({ docId: doc.id, filename: doc.name })}
                                />
                                {doc.status === 'uploaded' && (
                                    <>
                                        <button
                                            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-50"
                                            title="Verify"
                                            disabled={verifyDoc.isPending}
                                            onClick={() => verifyDoc.mutate(doc.id, { onSuccess: () => docsQuery.refetch() })}
                                        >
                                            <CheckCircle size={14} />
                                        </button>
                                        <button
                                            className="p-1.5 rounded-md text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                                            title="Reject"
                                            disabled={rejectDoc.isPending}
                                            onClick={() => {
                                                if (window.confirm(`Reject "${doc.name}"?`)) {
                                                    rejectDoc.mutate({ docId: doc.id, reason: 'Rejected by admin' }, { onSuccess: () => docsQuery.refetch() });
                                                }
                                            }}
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.li>
                    ))}
                </motion.ul>
            )}
        </motion.div>
    );
}

// ─── Lifecycle section ───────────────────────────────────────────────────────
function LifecycleSection({ companyName }: { companyName: string }) {
    const auditQuery = useAuditLog(1, 200);
    const entries = useMemo(() => {
        const all = auditQuery.data?.entries ?? [];
        return all.filter((e) => {
            const actor = e.actor?.toLowerCase() ?? '';
            const metaCompany = String(e.metadata?.companyName ?? '').toLowerCase();
            const target = companyName.toLowerCase();
            return actor === target || metaCompany === target;
        });
    }, [auditQuery.data, companyName]);

    return (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-5 card-shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                        <AlertCircle size={14} />
                    </div>
                    <h3 className="text-sm font-bold text-[--color-text-primary]">Lifecycle</h3>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[--color-text-muted]">{entries.length} events</span>
            </div>
            {auditQuery.isLoading ? (
                <p className="text-sm text-[--color-text-muted]">Loading history…</p>
            ) : entries.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">No tracked events for this company yet.</p>
            ) : (
                <ol className="relative pl-5 space-y-3">
                    <span aria-hidden className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-indigo-500/30 via-[--color-border] to-transparent" />
                    {entries.slice(0, 20).map((e, i) => (
                        <li key={e.id} className="relative">
                            <span className={`absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[--color-surface] ${i === 0 ? 'bg-indigo-500' : 'bg-[--color-border-strong]'}`} />
                            <p className="text-[10px] text-[--color-text-muted] tabular-nums font-mono">{new Date(e.timestamp).toLocaleString('en-ZA')}</p>
                            <p className="text-sm text-[--color-text-primary]">
                                <span className="font-semibold">{e.actor}</span>{' '}
                                <span className="text-[--color-text-muted]">{e.action}</span>
                            </p>
                        </li>
                    ))}
                </ol>
            )}
        </motion.div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AdminCompanyDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = use(params);
    const companiesQuery = useAdminCompanies();
    const updateCompany = useUpdateAdminCompany();
    const sendReset = useSendPasswordReset();

    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [actionsOpen, setActionsOpen] = useState(false);
    const [resetModal, setResetModal] = useState<{ email: string; link: string; copied: boolean } | null>(null);
    const [resetBusyUserId, setResetBusyUserId] = useState<string | null>(null);
    const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

    const company = (companiesQuery.data ?? []).find((c) => c.id === companyId);

    if (companiesQuery.isLoading) return <div className="space-y-6 max-w-[1280px] mx-auto"><CardSkeleton /><CardSkeleton /></div>;
    if (companiesQuery.isError) return <ErrorState onRetry={() => companiesQuery.refetch()} />;
    if (!company) return <ErrorState title="Company not found" message="This client may have been removed or the link is stale." />;

    const tone = STATUS_TONE[company.status] ?? STATUS_TONE.pending;
    const isVerified = company.status === 'verified';
    const isPending = company.status === 'pending';
    const isSuspended = company.status === 'rejected';

    const setStatus = async (next: Company['status'], successMessage: string) => {
        try {
            await updateCompany.mutateAsync({ companyId, payload: { status: next } });
            setStatusFeedback(successMessage);
            setTimeout(() => setStatusFeedback(null), 4000);
        } catch (err) {
            setStatusFeedback(err instanceof Error ? err.message : 'Status update failed');
        }
        setActionsOpen(false);
    };

    const handleResetPassword = async (userId: string) => {
        setResetBusyUserId(userId);
        try {
            const result = await sendReset.mutateAsync({ companyId, userId });
            setResetModal({ email: result.email, link: result.resetLink, copied: false });
        } catch (err) {
            window.alert(err instanceof Error ? err.message : 'Failed to generate reset link');
        } finally {
            setResetBusyUserId(null);
        }
    };

    const copyResetLink = async () => {
        if (!resetModal) return;
        try {
            await navigator.clipboard.writeText(resetModal.link);
            setResetModal({ ...resetModal, copied: true });
        } catch {
            window.prompt('Copy this reset link:', resetModal.link);
        }
    };

    const handleSaveOverview = (payload: Partial<Company>) => {
        updateCompany.mutate(
            { companyId, payload },
            {
                onSuccess: () => {
                    setStatusFeedback('Profile saved.');
                    setTimeout(() => setStatusFeedback(null), 3000);
                },
                onError: (err) => {
                    setStatusFeedback(err instanceof Error ? err.message : 'Save failed');
                },
            },
        );
    };

    return (
        <div className="relative">
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 -z-10"
                style={{
                    backgroundImage:
                        'radial-gradient(800px 500px at 0% -10%, rgba(79,70,229,0.10), transparent 60%), radial-gradient(700px 400px at 100% 0%, rgba(124,58,237,0.08), transparent 55%)',
                }}
            />

            <div className="space-y-6 max-w-[1280px] mx-auto">
                {/* Back link */}
                <Link href="/admin/companies" className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-primary] leading-none">
                    <ArrowLeft size={14} /> Back to portfolio
                </Link>

                {/* ── HERO ─────────────────────────────────────────────────── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="relative overflow-hidden rounded-3xl border border-white/5 px-6 py-7 sm:px-9 sm:py-9"
                    style={{ background: 'linear-gradient(135deg, #0F0A2E 0%, #1E1B4B 35%, #312E81 65%, #1E3A5C 100%)' }}
                >
                    <motion.div
                        aria-hidden
                        className="absolute -top-24 -right-16 w-[420px] h-[420px] rounded-full blur-3xl opacity-50"
                        style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }}
                        animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
                        transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }}
                    />
                    <motion.div
                        aria-hidden
                        className="absolute -bottom-20 -left-10 w-[360px] h-[360px] rounded-full blur-3xl opacity-30"
                        style={{ background: 'radial-gradient(circle, #4F46E5 0%, transparent 70%)' }}
                        animate={{ x: [0, -14, 0], y: [0, 10, 0] }}
                        transition={{ repeat: Infinity, duration: 16, ease: 'easeInOut', delay: 1 }}
                    />
                    <motion.div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.10) 50%, transparent 70%)',
                            backgroundSize: '200% 100%',
                        }}
                        animate={{ backgroundPosition: ['-100% 0%', '200% 0%'] }}
                        transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                    />
                    <div
                        aria-hidden
                        className="absolute inset-0 opacity-[0.07]"
                        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                    />
                    <motion.div
                        aria-hidden
                        className="absolute -right-6 -bottom-8 opacity-[0.08]"
                        animate={{ rotate: [0, 6, 0] }}
                        transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }}
                    >
                        <Shield size={180} color="white" />
                    </motion.div>

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="flex items-start gap-5">
                            <motion.div
                                initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
                                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                transition={{ ...T.softSpring, delay: 0.05 }}
                                className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold"
                                style={{ background: tone.avatar, boxShadow: `0 8px 28px ${tone.glow}` }}
                            >
                                {initials(company.name)}
                            </motion.div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                                    Client workspace
                                </p>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                                    {company.name}
                                </h1>
                                <p className="mt-1.5 text-sm text-indigo-100/85">
                                    {company.registrationNumber || '—'} · {company.industry || 'Industry not set'} · {company.province || 'Province not set'}
                                </p>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase bg-white/[0.06] border-white/15 text-white`}>
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 -mt-0.5 align-middle ${tone.dot}`} />
                                        {tone.label}
                                    </span>
                                    {company.bbbeeLevel && (
                                        <span className="px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase bg-indigo-500/10 border-indigo-400/30 text-indigo-200">
                                            B-BBEE {company.bbbeeLevel}
                                        </span>
                                    )}
                                    {company.cidbGrade && (
                                        <span className="px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase bg-indigo-500/10 border-indigo-400/30 text-indigo-200">
                                            CIDB {company.cidbGrade}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="relative flex items-start gap-2 flex-shrink-0">
                            {!isVerified && (
                                <button
                                    type="button"
                                    onClick={() => setStatus('verified', `${company.name} marked verified.`)}
                                    disabled={updateCompany.isPending}
                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <ShieldCheck size={15} /> Verify
                                </button>
                            )}
                            {isVerified && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`Suspend ${company.name}? Clients with this company will be deactivated.`)) {
                                            setStatus('rejected', `${company.name} suspended.`);
                                        }
                                    }}
                                    disabled={updateCompany.isPending}
                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <ShieldOff size={15} /> Suspend
                                </button>
                            )}
                            {isSuspended && (
                                <button
                                    type="button"
                                    onClick={() => setStatus('pending', `${company.name} moved back to pending review.`)}
                                    disabled={updateCompany.isPending}
                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <Sparkles size={15} /> Reactivate
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setActionsOpen((o) => !o)}
                                className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 transition-colors cursor-pointer"
                                aria-label="More actions"
                            >
                                More <ChevronDown size={14} />
                            </button>

                            <AnimatePresence>
                                {actionsOpen && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setActionsOpen(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, y: -6, scale: 0.96 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                            transition={T.snappy}
                                            className="absolute right-0 top-full mt-2 z-40 w-56 bg-[--color-surface] border border-[--color-border] rounded-xl shadow-lg py-1"
                                            style={{ originY: 0, originX: 1 }}
                                        >
                                            {!isPending && (
                                                <button
                                                    type="button"
                                                    onClick={() => setStatus('pending', `${company.name} moved to pending review.`)}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-[--color-text-primary] hover:bg-[--color-bg] transition-colors cursor-pointer flex items-center gap-2"
                                                >
                                                    <Sparkles size={13} className="text-amber-500" /> Move to pending
                                                </button>
                                            )}
                                            {!isSuspended && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm(`Suspend ${company.name}?`)) {
                                                            setStatus('rejected', `${company.name} suspended.`);
                                                        }
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer flex items-center gap-2"
                                                >
                                                    <ShieldOff size={13} /> Suspend
                                                </button>
                                            )}
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>

                {statusFeedback && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-600"
                    >
                        <CheckCircle2 size={14} className="inline-block mr-2 -mt-0.5" />
                        {statusFeedback}
                    </motion.div>
                )}

                {/* ── TABS ─────────────────────────────────────────────────── */}
                <div className="flex items-center gap-1 border-b border-[--color-border]">
                    {([
                        { key: 'overview' as const, label: 'Overview', icon: <Building2 size={13} /> },
                        { key: 'members' as const, label: 'Members', icon: <UsersIcon size={13} /> },
                        { key: 'documents' as const, label: 'Documents', icon: <FileText size={13} /> },
                        { key: 'lifecycle' as const, label: 'Lifecycle', icon: <AlertCircle size={13} /> },
                    ]).map((t) => {
                        const active = activeTab === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setActiveTab(t.key)}
                                className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${active ? 'text-indigo-600' : 'text-[--color-text-muted] hover:text-[--color-text-primary]'}`}
                            >
                                {t.icon} {t.label}
                                {active && (
                                    <motion.span
                                        layoutId="tab-underline"
                                        className="absolute left-2 right-2 -bottom-px h-0.5 bg-indigo-500 rounded-full"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── TAB CONTENT ──────────────────────────────────────────── */}
                <div>
                    {activeTab === 'overview' && (
                        <OverviewSection company={company} onSave={handleSaveOverview} saving={updateCompany.isPending} />
                    )}
                    {activeTab === 'members' && (
                        <MembersSection companyId={companyId} onResetPassword={handleResetPassword} busyUserId={resetBusyUserId} />
                    )}
                    {activeTab === 'documents' && <DocumentsSection companyId={companyId} />}
                    {activeTab === 'lifecycle' && <LifecycleSection companyName={company.name} />}
                </div>
            </div>

            {/* ── RESET PASSWORD MODAL ─────────────────────────────────── */}
            <Modal
                open={resetModal !== null}
                onClose={() => setResetModal(null)}
                title="Password reset link"
                size="md"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setResetModal(null)}>Close</Button>
                        <Button onClick={copyResetLink} leftIcon={<Copy size={14} />}>
                            {resetModal?.copied ? 'Copied!' : 'Copy link'}
                        </Button>
                    </>
                }
            >
                {resetModal && (
                    <div className="space-y-3">
                        <p className="text-sm text-[--color-text-muted]">
                            Share this link with <span className="font-mono text-[--color-text-primary]">{resetModal.email}</span>. The link is single-use and expires per Firebase policy.
                        </p>
                        <div className="rounded-xl border border-[--color-border] bg-[--color-bg] p-3 text-xs font-mono break-all">
                            {resetModal.link}
                        </div>
                        <p className="text-[11px] text-[--color-text-muted]">
                            Don&apos;t post this in public channels. Treat it like a temporary password.
                        </p>
                    </div>
                )}
            </Modal>
        </div>
    );
}
