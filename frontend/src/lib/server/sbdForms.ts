import type { Company, DocumentCategory, TenderDetail } from '@/lib/api/types';
import type { InternalDocument } from './mockData';
import type { TenderDocument } from './tenderScraper';

export const SBD_FORM_IDS = ['sbd1', 'sbd2', 'sbd4', 'sbd6_1', 'sbd6_2', 'sbd8', 'sbd9'] as const;

export type SbdFormId = typeof SBD_FORM_IDS[number];

interface SbdPackInput {
  company: Company;
  documents: InternalDocument[];
  tender?: TenderDetail | null;
  tenderSourceDocuments?: TenderDocument[];
  requestedForms?: SbdFormId[];
  generatedAt?: Date;
}

interface PrefillData {
  companyName: string;
  registrationNumber: string;
  vatNumber: string;
  taxNumber: string;
  csdNumber: string;
  bbbeeLevel: string;
  cidbGrade: string;
  address: string;
  phone: string;
  email: string;
  province: string;
  industry: string;
  taxCompliance: string;
  directorEvidence: string;
  registrationEvidence: string;
  bbbeeEvidence: string;
}

const FORM_TITLES: Record<SbdFormId, string> = {
  sbd1: 'SBD 1 - Invitation to Bid',
  sbd2: 'SBD 2 - Tax Matters',
  sbd4: 'SBD 4 - Bidder Disclosure',
  sbd6_1: 'SBD 6.1 - Preference Points Claim',
  sbd6_2: 'SBD 6.2 - Local Content Declaration',
  sbd8: 'SBD 8 - Declaration of Bidder Past SCM Practices',
  sbd9: 'SBD 9 - Certificate of Independent Bid Determination',
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

export function createSbdPackFilename(companyName: string, tenderTitle?: string): string {
  const parts = [companyName, tenderTitle, 'sbd-pack']
    .filter(Boolean)
    .map((part) => cleanFilenamePart(String(part)))
    .filter(Boolean);
  return `${parts.join('-') || 'sbd-pack'}.html`;
}

function getDocumentText(document: InternalDocument): string {
  return [
    document.name,
    document.extractedText,
    document.aiSummary,
    document.documentAnalysis?.keywords?.join(' '),
    document.documentAnalysis?.csdSupplierSummary
      ? Object.values(document.documentAnalysis.csdSupplierSummary).join(' ')
      : '',
  ].filter(Boolean).join('\n');
}

function findDocument(documents: InternalDocument[], categories: DocumentCategory[]): InternalDocument | undefined {
  return documents.find((document) => categories.includes(document.category));
}

function extractFirstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[0];
    if (value) return value.trim();
  }
  return '';
}

function extractTaxNumber(documents: InternalDocument[]): string {
  const taxDocs = documents.filter((document) => ['tax', 'tax_clearance', 'sars_pin', 'vat_certificate'].includes(document.category));
  const text = taxDocs.map(getDocumentText).join('\n');
  return extractFirstMatch(text, [
    /\b(?:income\s*)?tax\s*(?:reference\s*)?(?:number|no\.?)\s*[:\-]?\s*([0-9]{10})\b/i,
    /\bSARS\s*(?:tax\s*)?(?:number|no\.?)\s*[:\-]?\s*([0-9]{10})\b/i,
    /\b([0-9]{10})\b/,
  ]);
}

function extractBbbeeLevel(company: Company, documents: InternalDocument[]): string {
  if (company.bbbeeLevel) return company.bbbeeLevel;
  const csdLevel = documents
    .map((document) => document.documentAnalysis?.csdSupplierSummary?.bbbeeLevel)
    .find(Boolean);
  if (csdLevel) return csdLevel;
  const text = documents
    .filter((document) => ['bbbee', 'bbbee_certificate', 'bbbee_affidavit'].includes(document.category))
    .map(getDocumentText)
    .join('\n');
  const level = extractFirstMatch(text, [
    /\b(?:B-BBEE|BBBEE|BEE)\s*(?:status\s*)?(?:level)?\s*[:\-]?\s*(?:Level\s*)?([1-8])\b/i,
    /\bLevel\s*([1-8])\b/i,
  ]);
  return level ? `Level ${level}` : '';
}

function formatDocumentEvidence(document: InternalDocument | undefined): string {
  if (!document) return 'Not captured';
  const expiry = document.expiryDate ? `, expires ${document.expiryDate}` : '';
  return `${document.name} (${document.status}${expiry})`;
}

function buildPrefillData(company: Company, documents: InternalDocument[]): PrefillData {
  const csdSummary = documents
    .map((document) => document.documentAnalysis?.csdSupplierSummary)
    .find((summary) => summary?.isCsdSupplierSummary);
  const directorDoc = findDocument(documents, ['director_ids', 'shareholder_register']);
  const registrationDoc = findDocument(documents, ['registration', 'cipc_registration', 'company_profile', 'csd_supplier_summary']);
  const bbbeeDoc = findDocument(documents, ['bbbee', 'bbbee_certificate', 'bbbee_affidavit']);
  const taxDoc = findDocument(documents, ['tax', 'tax_clearance', 'sars_pin']);

  return {
    companyName: company.name || csdSummary?.legalName || 'Not captured',
    registrationNumber: company.registrationNumber || csdSummary?.registrationNumber || 'Not captured',
    vatNumber: company.vatNumber || csdSummary?.vatNumber || 'Not captured',
    taxNumber: extractTaxNumber(documents) || csdSummary?.taxNumber || 'Not captured',
    csdNumber: company.csdNumber || csdSummary?.supplierNumber || 'Not captured',
    bbbeeLevel: extractBbbeeLevel(company, documents) || csdSummary?.bbbeeLevel || 'Not captured',
    cidbGrade: company.cidbGrade || csdSummary?.cidbGrade || 'Not captured',
    address: company.address || 'Not captured',
    phone: company.phone || 'Not captured',
    email: company.email || 'Not captured',
    province: company.province || csdSummary?.province || 'Not captured',
    industry: company.industry || 'Not captured',
    taxCompliance: csdSummary?.taxCompliant === true ? 'Tax compliant per CSD summary' : formatDocumentEvidence(taxDoc),
    directorEvidence: formatDocumentEvidence(directorDoc),
    registrationEvidence: formatDocumentEvidence(registrationDoc),
    bbbeeEvidence: formatDocumentEvidence(bbbeeDoc),
  };
}

function field(label: string, value: string): string {
  return `<div class="field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function yesNo(label: string, value = 'Manual confirmation required'): string {
  return `<div class="yn"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}

function section(title: string, body: string): string {
  return `<section class="form"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function tenderFields(tender?: TenderDetail | null): string {
  return [
    field('Tender title', tender?.title || 'Not captured'),
    field('Tender number', tender?.tenderNumber || 'Not captured'),
    field('Institution', tender?.organization || 'Not captured'),
    field('Closing date', tender?.deadline || 'Not captured'),
    field('Estimated value', tender?.value || 'Not captured'),
    field('Source site', tender?.sourceSite || 'Not captured'),
    field('Source URL', tender?.sourceUrl || 'Not captured'),
  ].join('');
}

function renderTenderSourceDocuments(documents: TenderDocument[] | undefined): string {
  const items = (documents ?? []).filter((document) => document.filename || document.url);
  if (!items.length) {
    return '<p class="meta">No source tender PDF attachments were captured for this tender.</p>';
  }

  return `<div class="source-docs">${items.map((document) => `
    <div class="source-doc">
      <strong>${escapeHtml(document.filename || 'Tender source document')}</strong>
      <span>${escapeHtml(document.url || 'No URL captured')}</span>
      <small>${escapeHtml(document.extractionStatus || 'unknown')} extraction${document.pageCount ? `, ${escapeHtml(document.pageCount)} pages` : ''}</small>
    </div>
  `).join('')}</div>`;
}
function renderSbd1(data: PrefillData, tender?: TenderDetail | null): string {
  return section(FORM_TITLES.sbd1, `
    <h3>Part A: Invitation to Bid</h3>
    ${tenderFields(tender)}
    <h3>Part B: Terms and Conditions for Bidding</h3>
    ${field('Bidder name', data.companyName)}
    ${field('Company registration number', data.registrationNumber)}
    ${field('CSD supplier number', data.csdNumber)}
    ${field('VAT number', data.vatNumber)}
    ${field('Physical address', data.address)}
    ${field('Contact email', data.email)}
    ${field('Telephone', data.phone)}
    <p class="note">Generated fields must be reviewed and signed by the authorised bidder before submission.</p>
  `);
}

function renderSbd2(data: PrefillData): string {
  return section(FORM_TITLES.sbd2, `
    ${field('Bidder name', data.companyName)}
    ${field('Tax reference number', data.taxNumber)}
    ${field('VAT number', data.vatNumber)}
    ${field('Tax compliance evidence', data.taxCompliance)}
    ${field('CSD supplier number', data.csdNumber)}
    ${yesNo('Are your tax affairs in order?')}
    <p class="note">Confirm tax status against the current SARS TCS PIN or CSD record before submitting.</p>
  `);
}

function renderSbd4(data: PrefillData): string {
  return section(FORM_TITLES.sbd4, `
    ${field('Bidder name', data.companyName)}
    ${field('Registration number', data.registrationNumber)}
    ${field('Director/shareholder evidence', data.directorEvidence)}
    ${yesNo('Any relation to persons employed by the state?')}
    ${yesNo('Any interest in another bidding entity?')}
    ${yesNo('Any state employee ownership, directorship, or advisory relationship?')}
    <p class="note">Structured director names and ID numbers are not yet captured in the company profile, so conflict declarations require manual confirmation.</p>
  `);
}

function renderSbd61(data: PrefillData, tender?: TenderDetail | null): string {
  return section(FORM_TITLES.sbd6_1, `
    ${field('Bidder name', data.companyName)}
    ${field('Tender value', tender?.value || 'Not captured')}
    ${field('B-BBEE status level', data.bbbeeLevel)}
    ${field('B-BBEE evidence', data.bbbeeEvidence)}
    ${field('Preference points system', 'Confirm 80/20 or 90/10 from tender document')}
    ${field('Claimed preference points', 'Manual calculation required')}
    <p class="note">Preference points depend on the procuring institution rules and tender value threshold. Review before submission.</p>
  `);
}

function renderSbd62(data: PrefillData, tender?: TenderDetail | null): string {
  return section(FORM_TITLES.sbd6_2, `
    ${field('Bidder name', data.companyName)}
    ${field('Tender title', tender?.title || 'Not captured')}
    ${field('Industry / sector', data.industry)}
    ${field('Province', data.province)}
    ${yesNo('Does this bid include designated local content requirements?')}
    ${field('Local content percentage', 'Manual completion required')}
    <p class="note">Local content schedules are tender-specific and must be completed from the bid document bill of materials.</p>
  `);
}

function renderSbd8(data: PrefillData): string {
  return section(FORM_TITLES.sbd8, `
    ${field('Bidder name', data.companyName)}
    ${field('Registration evidence', data.registrationEvidence)}
    ${yesNo('Was the bidder convicted of fraud or corruption in the past five years?')}
    ${yesNo('Was a contract terminated for poor performance?')}
    ${yesNo('Is the bidder restricted from doing business with the public sector?')}
    <p class="note">Past SCM practice declarations cannot be inferred from uploaded compliance documents and require authorised confirmation.</p>
  `);
}

function renderSbd9(data: PrefillData, tender?: TenderDetail | null): string {
  return section(FORM_TITLES.sbd9, `
    ${field('Bidder name', data.companyName)}
    ${field('Tender title', tender?.title || 'Not captured')}
    ${field('Institution', tender?.organization || 'Not captured')}
    ${yesNo('Was this bid arrived at independently?')}
    ${yesNo('Were prices or bid terms disclosed to competitors?')}
    ${yesNo('Was there consultation, communication, agreement, or arrangement with competitors?')}
    <p class="note">Competition-law declarations must be reviewed and signed by the authorised representative.</p>
  `);
}

function renderForm(formId: SbdFormId, data: PrefillData, tender?: TenderDetail | null): string {
  switch (formId) {
    case 'sbd1': return renderSbd1(data, tender);
    case 'sbd2': return renderSbd2(data);
    case 'sbd4': return renderSbd4(data);
    case 'sbd6_1': return renderSbd61(data, tender);
    case 'sbd6_2': return renderSbd62(data, tender);
    case 'sbd8': return renderSbd8(data);
    case 'sbd9': return renderSbd9(data, tender);
  }
}

export function normalizeSbdFormIds(values: string[] | null | undefined): SbdFormId[] {
  const selected = (values ?? []).filter((value): value is SbdFormId =>
    SBD_FORM_IDS.includes(value as SbdFormId)
  );
  return selected.length ? selected : [...SBD_FORM_IDS];
}

export function generateSbdPackHtml(input: SbdPackInput): string {
  const generatedAt = input.generatedAt ?? new Date();
  const formIds = input.requestedForms?.length ? input.requestedForms : [...SBD_FORM_IDS];
  const data = buildPrefillData(input.company, input.documents);
  const forms = formIds.map((formId) => renderForm(formId, data, input.tender)).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.company.name)} SBD Pack</title>
  <style>
    :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #111827; }
    body { margin: 0; background: #f3f4f6; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 20px; }
    .cover, .form { background: #fff; border: 1px solid #d1d5db; padding: 28px; margin-bottom: 20px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 0 0 18px; font-size: 21px; border-bottom: 2px solid #111827; padding-bottom: 8px; }
    h3 { margin: 18px 0 10px; font-size: 14px; text-transform: uppercase; color: #374151; }
    .meta { color: #4b5563; font-size: 13px; line-height: 1.5; }
    .field, .yn { display: grid; grid-template-columns: 240px 1fr; gap: 14px; border-bottom: 1px solid #e5e7eb; padding: 10px 0; font-size: 13px; }
    .field span, .yn span { color: #4b5563; }
    .field strong, .yn b { min-height: 18px; font-weight: 700; color: #111827; }
    .note { margin: 18px 0 0; padding: 10px 12px; background: #fff7ed; border: 1px solid #fed7aa; color: #7c2d12; font-size: 12px; line-height: 1.5; }
    .source-docs { display: grid; gap: 8px; margin-top: 16px; }
    .source-doc { border: 1px solid #e5e7eb; padding: 10px 12px; font-size: 12px; display: grid; gap: 3px; }
    .source-doc span { color: #4b5563; word-break: break-all; }
    .source-doc small { color: #6b7280; }
    .signature { display: grid; grid-template-columns: 1fr 180px; gap: 18px; margin-top: 28px; }
    .line { border-bottom: 1px solid #111827; height: 32px; }
    @media print {
      body { background: #fff; }
      main { padding: 0; max-width: none; }
      .cover, .form { border: none; page-break-after: always; margin: 0; padding: 18mm; }
    }
  </style>
</head>
<body>
  <main>
    <section class="cover">
      <h1>SBD Pre-filled Forms Pack</h1>
      <p class="meta">
        Company: ${escapeHtml(input.company.name)}<br />
        Registration: ${escapeHtml(input.company.registrationNumber || 'Not captured')}<br />
        Tender: ${escapeHtml(input.tender?.title || 'Not linked to a tender')}<br />
        Generated: ${escapeHtml(generatedAt.toISOString())}
      </p>
      <p class="note">This pack is pre-filled from Tender Guard Pro profile, B-BBEE, tax, registration, CSD, and document-vault data. It is not a final legal declaration until reviewed, completed, signed, and accepted by the procuring institution.</p>
      <h3>Matched tender source PDFs</h3>
      ${renderTenderSourceDocuments(input.tenderSourceDocuments)}
    </section>
    ${forms}
    <section class="form">
      <h2>Authorised Sign-off</h2>
      ${field('Authorised representative name', 'Manual completion required')}
      ${field('Capacity', 'Manual completion required')}
      <div class="signature"><div><div class="line"></div><p class="meta">Signature</p></div><div><div class="line"></div><p class="meta">Date</p></div></div>
    </section>
  </main>
</body>
</html>`;
}
