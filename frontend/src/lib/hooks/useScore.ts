import { useQuery } from '@tanstack/react-query';
import { score } from '../api/score';
import { useAppStore } from '@/store/useAppStore';

export function useScore() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    return useQuery({
        queryKey: ['score', activeCompanyId],
        queryFn: () => score.getCurrent(activeCompanyId),
        enabled: !!activeCompanyId,
    });
}

export function useScoreHistory() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    return useQuery({
        queryKey: ['score-history', activeCompanyId],
        queryFn: () => score.getHistory(activeCompanyId),
        enabled: !!activeCompanyId,
    });
}
