import type { ScoreBand, DocumentStatus } from '../api/types';

export function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function scoreBandLabel(band: ScoreBand): string {
    const labels: Record<ScoreBand, string> = {
        'tender-ready': 'Tender Ready',
        'partially-ready': 'Partially Ready',
        'high-risk': 'High Risk',
    };
    return labels[band];
}

export function scoreBandColor(band: ScoreBand): 'success' | 'warning' | 'danger' {
    const map: Record<ScoreBand, 'success' | 'warning' | 'danger'> = {
        'tender-ready': 'success',
        'partially-ready': 'warning',
        'high-risk': 'danger',
    };
    return map[band];
}

export function scoreFromNumber(score: number): ScoreBand {
    if (score >= 85) return 'tender-ready';
    if (score >= 65) return 'partially-ready';
    return 'high-risk';
}

export function docStatusColor(
    status: DocumentStatus
): 'success' | 'warning' | 'danger' | 'accent' {
    const map: Record<DocumentStatus, 'success' | 'warning' | 'danger' | 'accent'> = {
        verified: 'success',
        uploaded: 'accent',
        rejected: 'danger',
        expired: 'warning',
    };
    return map[status];
}

export function docStatusLabel(status: DocumentStatus): string {
    const labels: Record<DocumentStatus, string> = {
        verified: 'Verified',
        uploaded: 'Uploaded',
        rejected: 'Rejected',
        expired: 'Expired',
    };
    return labels[status];
}

export function docCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
        tax: 'Tax',
        legal: 'Legal',
        financial: 'Financial',
        certification: 'Certification',
        bbbee: 'B-BBEE',
        registration: 'Registration',
        policy: 'Policy',
        tax_clearance: 'Tax Clearance Certificate',
        sars_pin: 'SARS TCS PIN',
        vat_certificate: 'VAT Certificate',
        cipc_registration: 'CIPC Registration',
        company_profile: 'Company Profile',
        csd_supplier_summary: 'CSD Supplier Summary',
        director_ids: 'Director IDs',
        shareholder_register: 'Shareholder Register',
        bbbee_certificate: 'B-BBEE Certificate',
        bbbee_affidavit: 'B-BBEE Affidavit',
        cidb_certificate: 'CIDB Certificate',
        nhbrc_certificate: 'NHBRC Certificate',
        letter_good_standing: 'Letter of Good Standing',
        coida_certificate: 'COIDA Certificate',
        public_liability_insurance: 'Public Liability Insurance',
        professional_indemnity: 'Professional Indemnity',
        financial_statements: 'Financial Statements',
        bank_statement: 'Bank Statement',
        bank_confirmation: 'Bank Confirmation Letter',
        municipal_account: 'Municipal Account',
        proof_of_address: 'Proof of Address',
        lease_agreement: 'Lease Agreement',
        health_safety_plan: 'Health & Safety Plan',
        quality_management_policy: 'Quality Management Policy',
        environmental_policy: 'Environmental Policy',
        iso_certificate: 'ISO Certificate',
        poa_authority: 'Power of Attorney / Authority',
        joint_venture_agreement: 'Joint Venture Agreement',
        other_compliance: 'Other Compliance Document',
    };
    return labels[category] ?? category;
}

export function daysUntilExpiry(expiryDate: string | null): number | null {
    if (!expiryDate) return null;
    const diff = new Date(expiryDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function classNames(...classes: (string | undefined | false | null)[]): string {
    return classes.filter(Boolean).join(' ');
}
