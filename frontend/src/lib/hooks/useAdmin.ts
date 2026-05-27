import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admin } from '../api/admin';

export function useAdminDashboard() {
    return useQuery({
        queryKey: ['admin-stats'],
        queryFn: () => admin.getPortfolioStats(),
    });
}

export function useRenewalsPipeline() {
    return useQuery({
        queryKey: ['admin-renewals'],
        queryFn: () => admin.getRenewalsPipeline(),
    });
}

export function useAuditLog(page = 1, pageSize = 20) {
    return useQuery({
        queryKey: ['audit-log', page, pageSize],
        queryFn: () => admin.getAuditLog({ page, pageSize }),
    });
}

export function useAdminCompanies() {
    return useQuery({
        queryKey: ['admin-companies'],
        queryFn: () => admin.listCompanies(),
    });
}

export function useAdminCompanyUsers(companyId: string) {
    return useQuery({
        queryKey: ['admin-company-users', companyId],
        queryFn: () => admin.listCompanyUsers(companyId),
        enabled: !!companyId,
    });
}

export function useUpdateAdminCompany() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ companyId, payload }: { companyId: string; payload: Parameters<typeof admin.updateCompany>[1] }) =>
            admin.updateCompany(companyId, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin-companies'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
        },
    });
}

export function useSendPasswordReset() {
    return useMutation({
        mutationFn: ({ companyId, userId }: { companyId: string; userId: string }) =>
            admin.sendPasswordReset(companyId, userId),
    });
}

export function usePendingAdminDocuments() {
    return useQuery({
        queryKey: ['admin-pending-docs'],
        queryFn: () => admin.listPendingDocuments(),
    });
}

export function useAdminAccounts(status: 'pending' | 'approved' | 'rejected' | 'all' = 'all') {
    return useQuery({
        queryKey: ['admin-accounts', status],
        queryFn: () => admin.listAccounts(status === 'all' ? undefined : status),
    });
}

export function useInternalAdminUsers() {
    return useQuery({
        queryKey: ['internal-admin-users'],
        queryFn: () => admin.listInternalUsers(),
    });
}

export function useCreateInternalAdmin() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: { name: string; email: string; password: string }) => admin.createInternalAdmin(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['internal-admin-users'] }),
    });
}

export function useApproveAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (userId: string) => admin.approveAccount(userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-accounts'] }),
    });
}

export function useRejectAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, reason }: { userId: string; reason?: string }) => admin.rejectAccount(userId, reason),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-accounts'] }),
    });
}

export function useResetPendingAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (userId: string) => admin.resetPending(userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-accounts'] }),
    });
}

export function useAdminCompanyDocuments(companyId: string) {
    return useQuery({
        queryKey: ['admin-company-docs', companyId],
        queryFn: () => admin.listCompanyDocuments(companyId),
        enabled: !!companyId,
    });
}

export function useVerifyDocument() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (docId: string) => admin.markDocumentVerified(docId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin-company-docs'] });
            qc.invalidateQueries({ queryKey: ['admin-pending-docs'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
        },
    });
}

export function useRejectDocument() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ docId, reason }: { docId: string; reason: string }) => admin.markDocumentRejected(docId, reason),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin-company-docs'] });
            qc.invalidateQueries({ queryKey: ['admin-pending-docs'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
        },
    });
}

export function useAdminDownloadDocument() {
    return useMutation({
        mutationFn: ({ docId, filename }: { docId: string; filename: string }) => admin.downloadDocument(docId, filename),
    });
}
