import { useQuery } from '@tanstack/react-query';
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
