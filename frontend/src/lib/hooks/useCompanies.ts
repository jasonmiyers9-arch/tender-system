import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companies } from '../api/companies';
import { useAppStore } from '@/store/useAppStore';

export function useCompanies() {
    return useQuery({
        queryKey: ['companies'],
        queryFn: () => companies.listMyCompanies(),
        staleTime: 5 * 60 * 1000,     // treat as fresh for 5 minutes
        refetchOnWindowFocus: false,
    });
}

export function useActiveCompany() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    return useQuery({
        queryKey: ['company', activeCompanyId],
        queryFn: () => companies.getActive(),
        enabled: !!activeCompanyId,
    });
}

export function useSwitchCompany() {
    const setActiveCompany = useAppStore((s) => s.setActiveCompany);
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => companies.switchActive(id),
        onSuccess: (result) => {
            setActiveCompany(result.activeCompanyId);
            queryClient.invalidateQueries({ queryKey: ['companies'] });
            queryClient.invalidateQueries({ queryKey: ['company'] });
        },
    });
}

export function useUpdateCompanyProfile() {
    const activeCompanyId = useAppStore((s) => s.activeCompanyId);
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof companies.updateProfile>[0]) =>
            companies.updateProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['company', activeCompanyId] });
        },
    });
}
