'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAdminAccounts, useApproveAccount, useCreateInternalAdmin, useInternalAdminUsers, useRejectAccount, useResetPendingAccount } from '@/lib/hooks/useAdmin';
import { ShieldCheck, UserPlus, Users } from 'lucide-react';

export default function AdminAccountsPage() {
    const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const { data, isLoading, isError, error, refetch } = useAdminAccounts(status);
    const internalAdmins = useInternalAdminUsers();
    const approve = useApproveAccount();
    const reject = useRejectAccount();
    const resetPending = useResetPendingAccount();
    const createInternalAdmin = useCreateInternalAdmin();

    const items = data?.items ?? [];
    const adminItems = internalAdmins.data?.items ?? [];

    const closeCreateModal = () => {
        if (createInternalAdmin.isPending) return;
        setCreateModalOpen(false);
        setCreateError(null);
        setFormData({ name: '', email: '', password: '' });
    };

    const handleCreateInternalAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);

        if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
            setCreateError('Name, email, and password are required.');
            return;
        }

        if (formData.password.trim().length < 8) {
            setCreateError('Password must be at least 8 characters long.');
            return;
        }

        try {
            await createInternalAdmin.mutateAsync({
                name: formData.name.trim(),
                email: formData.email.trim(),
                password: formData.password,
            });
            closeCreateModal();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create internal admin account.');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <PageHeader
                title="Account Management"
                subtitle="Review external users and provision internal admin access."
                icon={<Users size={22} />}
                iconColor="#3B82F6"
                actions={
                    <Button size="sm" leftIcon={<UserPlus size={14} />} onClick={() => setCreateModalOpen(true)}>
                        Create Internal Admin
                    </Button>
                }
            />

            <Card
                header={
                    <div className="flex items-center justify-between gap-3 w-full">
                        <div>
                            <p className="text-sm font-semibold text-[--color-text-primary]">Internal Admin Users</p>
                            <p className="text-xs text-[--color-text-muted]">Provisioned platform operators who use the private admin portal.</p>
                        </div>
                        <Badge variant="accent" size="sm">{adminItems.length}</Badge>
                    </div>
                }
            >
                {internalAdmins.isLoading ? (
                    <p className="text-sm text-[--color-text-muted]">Loading internal admins...</p>
                ) : internalAdmins.isError ? (
                    <p className="text-sm text-[--color-danger]">{internalAdmins.error instanceof Error ? internalAdmins.error.message : 'Failed to load internal admins'}</p>
                ) : adminItems.length === 0 ? (
                    <p className="text-sm text-[--color-text-muted]">No internal admin users found.</p>
                ) : (
                    <ul className="space-y-3">
                        {adminItems.map((user) => (
                            <li key={user.id} className="p-3 rounded-lg border border-[--color-border] bg-[--color-bg] flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-[--color-text-primary]">{user.name}</p>
                                        <Badge variant="danger" size="sm" dot>Admin</Badge>
                                    </div>
                                    <p className="text-xs text-[--color-text-muted]">{user.email}</p>
                                    <p className="text-xs text-[--color-text-muted]">Created: {new Date(user.createdAt).toLocaleString('en-ZA')}</p>
                                </div>
                                <Badge variant={user.verificationStatus === 'approved' ? 'success' : 'warning'} size="sm">
                                    {user.verificationStatus}
                                </Badge>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <div className="flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                    <Button key={s} size="sm" variant={status === s ? 'primary' : 'ghost'} onClick={() => setStatus(s)}>
                        {s}
                    </Button>
                ))}
            </div>

            <Card>
                {isLoading ? (
                    <p className="text-sm text-[--color-text-muted]">Loading accounts...</p>
                ) : isError ? (
                    <p className="text-sm text-[--color-danger]">{error instanceof Error ? error.message : 'Failed to load accounts'}</p>
                ) : items.length === 0 ? (
                    <p className="text-sm text-[--color-text-muted]">No accounts found for this filter.</p>
                ) : (
                    <ul className="space-y-3">
                        {items.map((u) => (
                            <li key={u.id} className="p-3 rounded-lg border border-[--color-border] bg-[--color-bg]">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-[--color-text-primary]">{u.name}</p>
                                        <p className="text-xs text-[--color-text-muted]">{u.email}</p>
                                        <p className="text-xs text-[--color-text-muted]">Company: {u.companyName || '—'}</p>
                                        {u.verificationStatus === 'pending' && (
                                            <p className={`text-xs mt-1 ${u.slaBreached ? 'text-[--color-danger]' : 'text-[--color-text-muted]'}`}>
                                                Pending for {u.pendingHours}h {u.slaBreached ? '(SLA breached)' : ''}
                                            </p>
                                        )}
                                    </div>
                                    <Badge variant={u.verificationStatus === 'approved' ? 'success' : u.verificationStatus === 'rejected' ? 'danger' : 'warning'} size="sm">
                                        {u.verificationStatus}
                                    </Badge>
                                </div>
                                {u.verificationStatus === 'pending' && (
                                    <div className="mt-3 flex gap-2">
                                        <Button size="sm" onClick={() => approve.mutate(u.id, { onSuccess: () => refetch() })}>Approve</Button>
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() => {
                                                const reason = window.prompt('Reject reason (optional):') || undefined;
                                                reject.mutate({ userId: u.id, reason }, { onSuccess: () => refetch() });
                                            }}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                )}
                                {u.verificationStatus !== 'pending' && (
                                    <div className="mt-3 flex gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => resetPending.mutate(u.id, { onSuccess: () => refetch() })}>
                                            Move to Pending
                                        </Button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Modal
                open={createModalOpen}
                onClose={closeCreateModal}
                title="Create Internal Admin"
                size="md"
                footer={
                    <>
                        <Button variant="ghost" onClick={closeCreateModal} disabled={createInternalAdmin.isPending}>
                            Cancel
                        </Button>
                        <Button form="create-internal-admin-form" type="submit" loading={createInternalAdmin.isPending} leftIcon={<ShieldCheck size={14} />}>
                            Create Admin
                        </Button>
                    </>
                }
            >
                <form id="create-internal-admin-form" className="space-y-4" onSubmit={handleCreateInternalAdmin}>
                    <p className="text-sm text-[--color-text-muted]">
                        This creates a Firebase Auth email/password account and the matching internal `admin` user record.
                    </p>

                    {createError && (
                        <div className="rounded-xl border border-red-200 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10 px-4 py-3">
                            <p className="text-xs font-medium text-red-700 dark:text-red-400">{createError}</p>
                        </div>
                    )}

                    <Input
                        label="Full Name"
                        placeholder="e.g. Platform Ops Lead"
                        value={formData.name}
                        onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))}
                        required
                    />

                    <Input
                        type="email"
                        label="Work Email"
                        placeholder="ops@tenderguard.co.za"
                        value={formData.email}
                        onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
                        required
                    />

                    <Input
                        type="password"
                        label="Temporary Password"
                        placeholder="At least 8 characters"
                        hint="Share this securely with the staff member, then rotate it later if needed."
                        value={formData.password}
                        onChange={(e) => setFormData((current) => ({ ...current, password: e.target.value }))}
                        required
                    />
                </form>
            </Modal>
        </div>
    );
}
