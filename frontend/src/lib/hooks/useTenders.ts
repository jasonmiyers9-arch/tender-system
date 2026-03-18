import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenders } from '../api/tenders';
import { useAppStore } from '@/store/useAppStore';

export function useTenderMatches() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    return useQuery({
        queryKey: ['tenders', activeCompanyId],
        queryFn: () => tenders.listMatches(activeCompanyId),
        enabled: !!activeCompanyId,
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
    return useQuery({
        queryKey: ['tender-calendar', activeCompanyId],
        queryFn: () => tenders.getCalendar(),
        enabled: !!activeCompanyId,
    });
}

export function useCreateTender() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: tenders.createTender,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tenders'] });
            qc.invalidateQueries({ queryKey: ['tender-calendar'] });
        },
    });
}
