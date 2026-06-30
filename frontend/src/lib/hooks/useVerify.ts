import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { verify } from '../api/verify';

export function useVerifySearch(query: string) {
    return useQuery({
        queryKey: ['verify-search', query],
        queryFn: () => verify.searchCompanies(query),
        enabled: query.trim().length > 1,
    });
}

export function useVerifyCompany(companyId: string) {
    return useQuery({
        queryKey: ['verify-company', companyId],
        queryFn: () => verify.getCompanyReport(companyId),
        enabled: !!companyId,
    });
}

export function useEvaluatorCompanies() {
    return useQuery({
        queryKey: ['evaluator-companies'],
        queryFn: () => verify.searchCompanies(''),
    });
}

export function useEvaluatorActivity() {
    return useQuery({
        queryKey: ['evaluator-activity'],
        queryFn: () => verify.getActivity(),
    });
}

export function useVerifyCompanyStatus(companyId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => verify.verifyCompany(companyId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['verify-company', companyId] });
            qc.invalidateQueries({ queryKey: ['verify-search'] });
            qc.invalidateQueries({ queryKey: ['evaluator-companies'] });
        },
    });
}

export function useVerifyCompanyDocument(companyId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (documentId: string) => verify.verifyDocument(documentId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['verify-company', companyId] });
        },
    });
}
