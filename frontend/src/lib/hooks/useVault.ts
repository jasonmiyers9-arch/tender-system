import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vault } from '../api/vault';
import type { DocumentStatus, DocumentCategory } from '../api/types';
import { useAppStore } from '@/store/useAppStore';

export function useVaultDocuments(filters?: {
    status?: DocumentStatus;
    category?: DocumentCategory;
}) {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    const token = useAppStore((s) => s.token);
    return useQuery({
        queryKey: ['vault', activeCompanyId, filters],
        queryFn: () => vault.listDocuments(filters),
        enabled: !!token,
    });
}

export function useVaultDocument(docId: string) {
    const token = useAppStore((s) => s.token);
    return useQuery({
        queryKey: ['vault-doc', docId],
        queryFn: () => vault.getDocument(docId),
        enabled: !!docId && !!token,
    });
}

export function useUploadDocument() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: vault.uploadDocument,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vault', activeCompanyId] });
            queryClient.invalidateQueries({ queryKey: ['score', activeCompanyId] });
        },
    });
}

export function useRequestVerification() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (docId: string) => vault.requestVerification(docId),
        onSuccess: (_, docId) => {
            queryClient.invalidateQueries({ queryKey: ['vault', activeCompanyId] });
            queryClient.invalidateQueries({ queryKey: ['vault-doc', docId] });
        },
    });
}

export function useReExtractDocument() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (docId: string) => vault.reExtractDocument(docId),
        onSuccess: (_, docId) => {
            queryClient.invalidateQueries({ queryKey: ['vault', activeCompanyId] });
            queryClient.invalidateQueries({ queryKey: ['vault-doc', docId] });
        },
    });
}

export function useRenewals() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    const token = useAppStore((s) => s.token);
    return useQuery({
        queryKey: ['renewals', activeCompanyId],
        queryFn: () => vault.getRenewals(),
        enabled: !!token && !!activeCompanyId,
        staleTime: 1000 * 60, // 1 minute
    });
}

export function useRenewDocument() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ docId, data }: { docId: string; data: { issueDate?: string; expiryDate?: string } }) => 
            vault.renewDocument(docId, data),
        onSuccess: (_, { docId }) => {
            queryClient.invalidateQueries({ queryKey: ['vault', activeCompanyId] });
            queryClient.invalidateQueries({ queryKey: ['vault-doc', docId] });
            queryClient.invalidateQueries({ queryKey: ['renewals', activeCompanyId] });
            queryClient.invalidateQueries({ queryKey: ['score', activeCompanyId] });
        },
    });
}
