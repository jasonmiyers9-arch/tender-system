import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenders } from '../api/tenders';
import { useAppStore } from '@/store/useAppStore';

export function useTenderMatches() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    const role = useAppStore((s) => s.currentUser?.role);
    return useQuery({
        queryKey: ['tenders', activeCompanyId, role],
        queryFn: () => tenders.listMatches(),
        enabled: !!activeCompanyId || role === 'admin',
    });
}

export function useTender(tenderId: string) {
    return useQuery({
        queryKey: ['tender', tenderId],
        queryFn: () => tenders.getTender(tenderId),
        enabled: !!tenderId,
    });
}

export function useTenderReadiness(tenderId: string) {
    return useQuery({
        queryKey: ['tender-readiness', tenderId],
        queryFn: () => tenders.getReadiness(tenderId),
        enabled: !!tenderId,
    });
}

export function useTenderCalendar() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    const role = useAppStore((s) => s.currentUser?.role);
    return useQuery({
        queryKey: ['tender-calendar', activeCompanyId, role],
        queryFn: () => tenders.getCalendar(),
        enabled: !!activeCompanyId || role === 'admin' || role === 'super_admin' || role === 'evaluator',
    });
}

export function useSavedTenderSearches() {
    return useQuery({
        queryKey: ['tender-saved-searches'],
        queryFn: () => tenders.listSavedSearches(),
    });
}

export function useSaveTenderSearch() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: tenders.saveSearch,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tender-saved-searches'] }),
    });
}

export function useCreateTender() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: tenders.createTender,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tenders'] });
            qc.invalidateQueries({ queryKey: ['tender-calendar'] });
            qc.invalidateQueries({ queryKey: ['provider-tenders'] });
        },
    });
}

export function useProviderTenders() {
    const role = useAppStore((s) => s.currentUser?.role);
    return useQuery({
        queryKey: ['provider-tenders'],
        queryFn: () => tenders.listProviderTenders(),
        enabled: role === 'evaluator' || role === 'admin',
    });
}

export function useUpdateTender() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof tenders.updateTender>[1] }) =>
            tenders.updateTender(id, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tenders'] });
            qc.invalidateQueries({ queryKey: ['provider-tenders'] });
        },
    });
}

export function useDeleteTender() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => tenders.deleteTender(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tenders'] });
            qc.invalidateQueries({ queryKey: ['provider-tenders'] });
        },
    });
}
