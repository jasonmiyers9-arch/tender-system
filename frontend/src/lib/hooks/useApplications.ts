import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applicationsApi } from '../api/applications';
import { useAppStore } from '@/store/useAppStore';

export function useMyApplications() {
    return useQuery({
        queryKey: ['my-applications'],
        queryFn: () => applicationsApi.listMyApplications(),
    });
}

export function useMyApplicationForTender(tenderId: string) {
    return useQuery({
        queryKey: ['my-application', tenderId],
        queryFn: () => applicationsApi.getMyApplicationForTender(tenderId),
        enabled: !!tenderId,
    });
}

export function useProviderApplications() {
    const role = useAppStore((s) => s.currentUser?.role);
    return useQuery({
        queryKey: ['provider-applications'],
        queryFn: () => applicationsApi.listProviderApplications(),
        enabled: role === 'evaluator' || role === 'admin',
    });
}

export function useApplyForTender() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (tenderId: string) => applicationsApi.apply(tenderId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['my-applications'] });
            qc.invalidateQueries({ queryKey: ['my-application'] });
        },
    });
}

export function useApproveApplication() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (appId: string) => applicationsApi.approveApplication(appId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['provider-applications'] });
        },
    });
}

export function useRejectApplication() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ appId, reason }: { appId: string; reason?: string }) =>
            applicationsApi.rejectApplication(appId, reason),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['provider-applications'] });
        },
    });
}

export function useApplicationCompanyDocuments(appId: string | null) {
    return useQuery({
        queryKey: ['application-company-docs', appId],
        queryFn: () => applicationsApi.getApplicationCompanyDocuments(appId!),
        enabled: !!appId,
    });
}
