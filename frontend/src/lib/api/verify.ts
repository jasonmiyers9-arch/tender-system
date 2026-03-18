import type { CompanySearchResult, CompanyComplianceReport } from './types';

export const verify = {
    async searchCompanies(_query: string): Promise<CompanySearchResult[]> {
        return [];
    },

    async getCompanyReport(_companyId: string): Promise<CompanyComplianceReport> {
        throw new Error('No verification report found');
    },

    async getBundleUrl(_companyId: string): Promise<{ url: string }> {
        throw new Error('Bundle unavailable');
    },
};
