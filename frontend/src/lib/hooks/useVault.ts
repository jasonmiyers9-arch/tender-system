import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vault } from '../api/vault';
import type { DocumentStatus, DocumentCategory } from '../api/types';
import { useAppStore } from '@/store/useAppStore';

export function useVaultDocuments(filters?: {
    status?: DocumentStatus;
    category?: DocumentCategory;
}) {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    return useQuery({
        queryKey: ['vault', activeCompanyId, filters],
        queryFn: () => vault.listDocuments(filters),
    });
}

export function useVaultDocument(docId: string) {
    return useQuery({
        queryKey: ['vault-doc', docId],
        queryFn: () => vault.getDocument(docId),
        enabled: !!docId,
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
