import type { LegacyDocumentCategory } from '@/lib/api/types';

export interface CompetitorCapability {
  capability: string;
  tenderGuard: string;
  tenderFlow: string;
  ariscu: string;
}
export interface ScmUsp {
  title: string;
  summary: string;
}

export interface SbdForm {
  form: string;
  title: string;
  value: string;
}

export interface DocumentLifecycleStage {
  stage: string;
  description: string;
}

export interface ScmSector {
  code: string;
  name: string;
  aliases: string[];
  standardDocuments: string[];
  sectorDocuments: string[];
  expectedDocumentGroups: LegacyDocumentCategory[];
}

export const CORE_DOCUMENTS = [
  'CIPC Registration Certificate',
  'SARS Tax Compliance Status (TCS) Pin',
  'B-BBEE Certificate or Affidavit',
  'CSD Supplier Registration Summary',
  'UIF Registration Certificate',
  'Company Resolution and Certified Director IDs',
];

const STANDARD_INSURANCE_DOCUMENTS = [
  'COIDA Letter of Good Standing',
  'Professional Indemnity Insurance',
];

export const COMPETITOR_CAPABILITIES: CompetitorCapability[] = [
  {
    capability: 'Sector-specific document checklist across 28 SA sectors',
    tenderGuard: 'Built for every SA sector',
    tenderFlow: 'Not built',
    ariscu: 'No',
  },
  {
    capability: 'AI reads tender PDF and extracts requirements',
    tenderGuard: 'GPT-4o workflow in under 30 seconds',
    tenderFlow: 'No',
    ariscu: 'No',
  },
  {
    capability: 'Instant qualified YES/NO against company documents',
    tenderGuard: 'Core feature',
    tenderFlow: 'Not possible',
    ariscu: 'No',
  },
  {
    capability: 'Compulsory briefing date alerts',
    tenderGuard: 'Extracted, tracked, and alerted',
    tenderFlow: 'Not flagged',
    ariscu: 'No',
  },
  {
    capability: 'Document expiry tracking and renewal guides',
    tenderGuard: 'Per document type',
    tenderFlow: 'No',
    ariscu: 'Partial',
  },
  {
    capability: 'SBD form pre-population',
    tenderGuard: 'Phase 2: SBD 1, SBD 6, SBD 9',
    tenderFlow: 'No',
    ariscu: 'No',
  },
  {
    capability: 'Municipal supplier database tracking',
    tenderGuard: 'Per municipality',
    tenderFlow: 'No',
    ariscu: 'No',
  },
  {
    capability: 'SOE vendor registration tracking',
    tenderGuard: 'Dedicated Eskom, Transnet, PRASA, ACSA tracking',
    tenderFlow: 'No',
    ariscu: 'No',
  },
  {
    capability: 'SETA, QCTO, WSP, ATR compliance module',
    tenderGuard: 'Skills development sector',
    tenderFlow: 'No',
    ariscu: 'No',
  },
  {
    capability: 'B-BBEE preference points auto-calculator',
    tenderGuard: '80/20 and 90/10',
    tenderFlow: 'No',
    ariscu: 'No',
  },
  {
    capability: 'Multi-entity portfolio view',
    tenderGuard: 'Core design for 29+ companies',
    tenderFlow: 'Single entity only',
    ariscu: 'Enterprise tier',
  },
  {
    capability: 'Tender feed matched to company sector',
    tenderGuard: 'Auto-matched',
    tenderFlow: 'Broad listings',
    ariscu: 'No',
  },
  {
    capability: 'SMME-affordable SA pricing',
    tenderGuard: 'R990-R2,490 per month',
    tenderFlow: 'R900+ per month',
    ariscu: 'Enterprise only',
  },
  {
    capability: 'Built for South African SCM framework',
    tenderGuard: 'Yes',
    tenderFlow: 'Yes',
    ariscu: 'Global compliance tool',
  },
];

export const SCM_UNIQUE_SELLING_POINTS: ScmUsp[] = [
  {
    title: 'Sector Intelligence - 28 sectors, not a generic list',
    summary:
      'Tender Guard Pro maps broad tender categories into actionable South African business sectors, each with a specific document checklist.',
  },
  {
    title: 'One-click tender qualification',
    summary:
      'Upload a tender PDF or paste a URL, extract mandatory requirements, and return a qualified YES/NO with a specific gap list.',
  },
  {
    title: 'Compulsory briefing date tracking',
    summary:
      'Briefing dates and compulsory briefing flags are extracted from tender documents and pushed into calendar alerts.',
  },
  {
    title: 'SCM SBD form pre-population',
    summary:
      'Phase 2 generates pre-filled SBD forms from company profile, B-BBEE, director, tax, and registration data.',
  },
  {
    title: 'Multi-entity portfolio dashboard',
    summary:
      'Groups can view readiness scores, expiring documents, and tender-ready status across all entities in one place.',
  },
  {
    title: 'Document workflow from upload to tender-ready',
    summary:
      'Documents move through upload, verification, active, expiring, renewal, renewed, and audit history states.',
  },
];

export const SBD_FORMS: SbdForm[] = [
  {
    form: 'SBD 1',
    title: 'Invitation to Bid',
    value: 'Company details and contact information. Phase 2: auto-filled from company profile.',
  },
  {
    form: 'SBD 2',
    title: 'Tax Matters',
    value: 'Tax compliance declaration linked to the SARS TCS Pin stored in the vault.',
  },
  {
    form: 'SBD 4',
    title: 'Declaration of Interest',
    value: 'Conflict of interest declaration using director data from the company profile.',
  },
  {
    form: 'SBD 6.1',
    title: 'Preference Points - 90/10',
    value: 'Auto-calculated from B-BBEE level and tender value where the 90/10 formula applies.',
  },
  {
    form: 'SBD 6.2',
    title: 'Preference Points - 80/20',
    value: 'Auto-calculated from B-BBEE level and tender value where the 80/20 formula applies.',
  },
  {
    form: 'SBD 8',
    title: 'Past SCM Practices Declaration',
    value: 'Standard declaration for tender fraud and false information history.',
  },
  {
    form: 'SBD 9',
    title: 'Certificate of Independent Bid Determination',
    value: 'Anti-collusion declaration required on every bid.',
  },
];

export const DOCUMENT_LIFECYCLE: DocumentLifecycleStage[] = [
  { stage: 'Upload', description: 'User uploads document and captures dates.' },
  { stage: 'Verified', description: 'Document is reviewed and approved.' },
  { stage: 'Active', description: 'Valid in the vault and included in readiness score.' },
  { stage: 'Expiring', description: 'Alert sent when the document is inside the renewal window.' },
  { stage: 'Renewal Guide', description: 'Step-by-step renewal instructions are shown.' },
  { stage: 'Renewed', description: 'New document is uploaded and score rises.' },
  { stage: 'History', description: 'Audit trail remains available for governance.' },
];

export const SCM_SECTORS: ScmSector[] = [
  {
    code: 'S01',
    name: 'Construction and Civil Engineering',
    aliases: ['construction', 'civil', 'building', 'gb', 'ce'],
    standardDocuments: [...CORE_DOCUMENTS, ...STANDARD_INSURANCE_DOCUMENTS, 'SARS VAT Registration for projects over R1M'],
    sectorDocuments: [
      'CIDB Contractor Grade Certificate (1CE-9CE or 1GB-9GB)',
      'NHBRC Home Builders Registration',
      'Construction Health and Safety Plan',
      'Environmental Management Programme',
      'ISO 9001 Quality Management Certificate',
      'Site-Specific Risk Assessment',
      'SACPCMP Registration',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal', 'policy', 'financial'],
  },
  {
    code: 'S02',
    name: 'Roads, Bridges and Infrastructure',
    aliases: ['roads', 'bridges', 'infrastructure', 'sanral'],
    standardDocuments: [...CORE_DOCUMENTS, ...STANDARD_INSURANCE_DOCUMENTS],
    sectorDocuments: [
      'CIDB Grade Certificate (1CE-9CE road classification)',
      'SANRAL Pre-qualification Certificate',
      'ECSA Registration',
      'Environmental Impact Assessment Approval',
      'SACPCMP Registration',
      'Road Safety Audit Qualification',
      'NRCS Approval for road materials',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S03',
    name: 'Electrical Engineering and Energy',
    aliases: ['electrical', 'energy', 'power', 'eskom', 'ipp'],
    standardDocuments: [...CORE_DOCUMENTS, ...STANDARD_INSURANCE_DOCUMENTS],
    sectorDocuments: [
      'CIDB Grade Certificate (1EP-9EP electrical)',
      'ECSA Registration',
      'Certificate of Compliance for Electrical Installations',
      'NERSA Registration or Licence',
      'Eskom Approved Vendor Certificate',
      'SANS 10142 Compliance Certificate',
      'SHEQ Certificate',
      'IPP Registration',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S04',
    name: 'Mechanical and Plant Engineering',
    aliases: ['mechanical', 'plant', 'pressure vessel', 'welding'],
    standardDocuments: [...CORE_DOCUMENTS, ...STANDARD_INSURANCE_DOCUMENTS],
    sectorDocuments: [
      'CIDB Grade Certificate (1ME-9ME mechanical)',
      'ECSA Registration',
      'SAIW Welding Certificate',
      'ASME Pressure Vessel Certificate',
      'ISO 3834 Welding Quality Certificate',
      'SHEQ Certificate',
      'PED Compliance Certificate',
      'OEM Authorisation Letters',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S05',
    name: 'Information and Communications Technology',
    aliases: ['ict', 'information technology', 'telecoms', 'computer', 'network', 'cyber'],
    standardDocuments: [...CORE_DOCUMENTS, 'Professional Indemnity Insurance', 'SARS VAT Registration'],
    sectorDocuments: [
      'SITA Registration',
      'ISO 27001 Information Security Certificate',
      'POPIA Compliance Declaration',
      'ICASA Registration or Type Approval',
      'Microsoft, Cisco, or AWS Partnership Certificates',
      'Cyber Insurance Policy',
      'NCA Membership',
      'ISPA Membership',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S06',
    name: 'Software Development and Systems Integration',
    aliases: ['software', 'systems integration', 'cloud', 'application', 'digital'],
    standardDocuments: [...CORE_DOCUMENTS, 'Professional Indemnity Insurance'],
    sectorDocuments: [
      'ISO 27001 Certificate',
      'POPIA Compliance Declaration',
      'SITA Registration',
      'AWS, Azure, or Google Cloud Partner Certification',
      'Agile or CMMI Process Certification',
      'Cyber Liability Insurance',
      'ISACA Membership',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S07',
    name: 'Skills Development, Training and Education',
    aliases: ['skills', 'training', 'education', 'seta', 'qcto', 'wsp', 'atr'],
    standardDocuments: [...CORE_DOCUMENTS, 'SARS VAT Registration above threshold'],
    sectorDocuments: [
      'QCTO Accreditation Certificate and Expiry Date',
      'SETA Accreditation Certificate',
      'DHET Registration for Private Colleges',
      'SAQA Qualification Recognition Letters',
      'WSP Submission Proof due 30 April',
      'ATR Submission Proof due 30 June',
      'NQF Alignment Letter per Programme',
      'Facilities Inspection Certificate',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'policy'],
  },
  {
    code: 'S08',
    name: 'Healthcare, Medical Supplies and Pharmaceutical',
    aliases: ['healthcare', 'medical', 'pharmaceutical', 'hospital', 'laboratory'],
    standardDocuments: [...CORE_DOCUMENTS, 'Professional Indemnity Insurance', 'COIDA Letter of Good Standing'],
    sectorDocuments: [
      'SAHPRA Registration Certificate',
      'HPCSA Registration',
      'SANC Registration',
      'Pharmacy Council Registration',
      'Cold Chain Compliance Certificate',
      'ISO 13485 Medical Devices Certificate',
      'GMP Certificate',
      'SANAS Accreditation',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal'],
  },
  {
    code: 'S09',
    name: 'Security Services and Investigations',
    aliases: ['security', 'investigation', 'guarding', 'psira', 'cctv'],
    standardDocuments: [...CORE_DOCUMENTS, ...STANDARD_INSURANCE_DOCUMENTS],
    sectorDocuments: [
      'PSIRA Registration Certificate',
      'PSIRA Annual Renewal Certificate',
      'Firearms Competency Certificate',
      'Electronic Security Certificate',
      'Control Room Operator Certificates',
      'SAIDSA Membership Certificate',
      'ISO 9001 Certificate',
      'Specialised Investigation Licence',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal'],
  },
  {
    code: 'S10',
    name: 'Cleaning, Hygiene and Facilities Management',
    aliases: ['cleaning', 'hygiene', 'facilities', 'pest control'],
    standardDocuments: [...CORE_DOCUMENTS, 'COIDA Letter of Good Standing'],
    sectorDocuments: [
      'NCCA Membership Certificate',
      'Occupational Health and Safety Compliance',
      'Chemical Handling Permit',
      'Pest Control Registration Certificate',
      'ISSA Membership',
      'ISO 9001 Certificate',
      'SHEQ Certificate',
      'Municipal Trading Licence',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'policy', 'legal'],
  },
  {
    code: 'S11',
    name: 'Transport, Logistics and Fleet Management',
    aliases: ['transport', 'logistics', 'fleet', 'freight', 'roadworthy'],
    standardDocuments: [...CORE_DOCUMENTS, 'COIDA Letter of Good Standing', 'Road Accident Fund Compliance'],
    sectorDocuments: [
      'Operating Licence',
      'CBRTA Cross Border Permit',
      'Professional Driver Permit Records',
      'Dangerous Goods Permit',
      'PPECB Accreditation',
      'GPS Fleet Tracking Certificate',
      'Road Freight Association Membership',
      'Vehicle Roadworthy Certificates',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal'],
  },
  {
    code: 'S12',
    name: 'Environmental Services and Waste Management',
    aliases: ['environmental', 'waste', 'dffe', 'nema', 'biohazard'],
    standardDocuments: [...CORE_DOCUMENTS, ...STANDARD_INSURANCE_DOCUMENTS],
    sectorDocuments: [
      'DEA or DFFE Waste Management Licence',
      'ISO 14001 Environmental Management Certificate',
      'NEMA Environmental Authorisation',
      'SANAS Accreditation',
      'ECSA Registration',
      'EAP Registration',
      'Biohazard or Medical Waste Certificate',
      'Green Star or GBCSA Certificate',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S13',
    name: 'Property, Real Estate and Valuation',
    aliases: ['property', 'real estate', 'valuation', 'valuer', 'ppra'],
    standardDocuments: [...CORE_DOCUMENTS, 'Professional Indemnity Insurance', 'SARS VAT Registration'],
    sectorDocuments: [
      'PPRA or EAAB Registration Certificate',
      'Fidelity Fund Certificate',
      'SACPVP Valuer Registration',
      'Rates Clearance Certificate',
      'NHBRC Enrolment',
      'Town Planning or Rezoning Approval Letters',
      'Municipal Building Plans Approval',
      'Bond Origination Accreditation',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal'],
  },
  {
    code: 'S14',
    name: 'Financial, Accounting and Audit Services',
    aliases: ['financial', 'accounting', 'audit', 'tax practitioner', 'agsa'],
    standardDocuments: [...CORE_DOCUMENTS, 'Professional Indemnity Insurance', 'Fidelity Bond or Insurance'],
    sectorDocuments: [
      'SAICA, SAIBA, or CIMA Registration Certificate',
      'Practice Number and Certificate of Good Standing',
      'AGSA Auditor Panel Registration',
      'IRBA Registration',
      'FSCA Licence',
      'SAIT Membership',
      'SAIPA Registration',
      'CIGFARO Membership',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal'],
  },
  {
    code: 'S15',
    name: 'Legal Services',
    aliases: ['legal', 'law', 'attorney', 'conveyancing', 'ccma'],
    standardDocuments: [...CORE_DOCUMENTS, 'Professional Indemnity Insurance', 'Fidelity Fund Certificate'],
    sectorDocuments: [
      'Legal Practice Council Certificate',
      'Fidelity Fund Certificate',
      'Conveyancing Right of Appearance Certificate',
      'Specialisation Accreditation',
      'AGSA Legal Panel Registration',
      'National Prosecuting Authority Accreditation',
      'CCMA Accreditation',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal'],
  },
  {
    code: 'S16',
    name: 'Supply, Delivery and Distribution',
    aliases: ['supply', 'delivery', 'distribution', 'distributor', 'oem'],
    standardDocuments: [...CORE_DOCUMENTS, 'COIDA Letter of Good Standing'],
    sectorDocuments: [
      'OEM Authorisation Letter or Distributor Certificate',
      'SABS Approval Mark',
      'NRCS Letter of Authority',
      'Import Permit',
      'PPECB Certificate',
      'Halaal or Kosher Certification',
      'ISO 9001 Quality Certificate',
      'NAACAM Membership',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal'],
  },
  {
    code: 'S17',
    name: 'Emergency, Disaster Management and Health and Safety',
    aliases: ['emergency', 'disaster', 'health and safety', 'fire', 'first aid'],
    standardDocuments: [...CORE_DOCUMENTS, ...STANDARD_INSURANCE_DOCUMENTS],
    sectorDocuments: [
      'HPCSA or Emergency Care Registration',
      'SAQCC Gas Certificate',
      'NFPA or SANS Fire Equipment Compliance',
      'Department of Labour OHS Designation',
      'First Aid Training Provider Accreditation',
      'Disaster Management Certificate',
      'SAMHS Accreditation',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S18',
    name: 'Catering, Food Services and Hospitality',
    aliases: ['catering', 'food', 'hospitality', 'kitchen', 'venue'],
    standardDocuments: [...CORE_DOCUMENTS, 'Municipal Trading Licence'],
    sectorDocuments: [
      'Certificate of Acceptability',
      'HACCP Food Safety Certificate',
      'Food Handler Certificates',
      'Liquor Licence',
      'SHEQ Certificate',
      'ISO 22000 Food Safety Certificate',
      'Pest Control Certificate',
      'Fire Safety Certificate',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S19',
    name: 'Media, Communications, Advertising and Marketing',
    aliases: ['media', 'communications', 'advertising', 'marketing', 'broadcasting'],
    standardDocuments: [...CORE_DOCUMENTS, 'Professional Indemnity Insurance'],
    sectorDocuments: [
      'ICASA Broadcasting Licence',
      'GCIS Approved Vendor Status',
      'IAB, AMASA, or PRISA Membership',
      'POPIA Compliance Declaration',
      'Brand South Africa Accreditation',
      'ISO 9001 Certificate',
      'Digital Verification Accreditation',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S20',
    name: 'Printing, Stationery and Office Supplies',
    aliases: ['printing', 'stationery', 'office supplies', 'paper'],
    standardDocuments: [...CORE_DOCUMENTS],
    sectorDocuments: [
      'NRCS Letter of Authority',
      'FSC Certification',
      'ISO 9001 Certificate',
      'SABS Approval',
      'OEM Supply Agreement',
      'Supplier Diversity Certificate',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification'],
  },
  {
    code: 'S21',
    name: 'Mining, Resources and Geology',
    aliases: ['mining', 'resources', 'geology', 'samrec', 'mhsa'],
    standardDocuments: [...CORE_DOCUMENTS, ...STANDARD_INSURANCE_DOCUMENTS],
    sectorDocuments: [
      'DMR Mining Right or Prospecting Right',
      'MHSA Section 11 Certificate',
      'ECSA or GSSA Registration',
      'SAMREC or SAMVAL Compliance',
      'Environmental Authorisation',
      'Water Use Licence',
      'Explosives Licence',
      'Mining Charter Compliance Certificate',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S22',
    name: 'Agriculture, Food Production and Veterinary',
    aliases: ['agriculture', 'farming', 'veterinary', 'food production', 'dalrrd'],
    standardDocuments: [...CORE_DOCUMENTS, 'COIDA Letter of Good Standing'],
    sectorDocuments: [
      'DALRRD Registration',
      'PPECB Export Accreditation',
      'GlobalGAP Certification',
      'Organic Certification',
      'Veterinary Council Registration',
      'NSPCA Certificate',
      'Plant Protection Certificate',
      'Food Safety Certificate',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S23',
    name: 'Manufacturing and Industrial',
    aliases: ['manufacturing', 'industrial', 'factory', 'sabs', 'nrcs'],
    standardDocuments: [...CORE_DOCUMENTS, ...STANDARD_INSURANCE_DOCUMENTS],
    sectorDocuments: [
      'SABS Mark of Approval',
      'NRCS Letter of Authority',
      'ISO 9001 Quality Management Certificate',
      'ISO 14001 Environmental Certificate',
      'OHSAS 18001 or ISO 45001 Safety Certificate',
      'SABS Product Certification Mark',
      'NAACAM Membership',
      'SEIFSA Membership',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S24',
    name: 'Human Resources, Staffing and Employee Wellness',
    aliases: ['human resources', 'staffing', 'recruitment', 'wellness', 'labour broker'],
    standardDocuments: [...CORE_DOCUMENTS, 'Professional Indemnity Insurance'],
    sectorDocuments: [
      'APSO Membership Certificate',
      'CCMA Accreditation',
      'HWSETA Accreditation',
      'EAP Provider Accreditation',
      'Labour Broker Registration',
      'SABPP Membership',
      'Disability Employment Equity Certificate',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal'],
  },
  {
    code: 'S25',
    name: 'Maintenance, Repair and Asset Management',
    aliases: ['maintenance', 'repair', 'asset management', 'service authorisation'],
    standardDocuments: [...CORE_DOCUMENTS, 'COIDA Letter of Good Standing'],
    sectorDocuments: [
      'CIDB Grade Certificate where applicable',
      'OEM Service Authorisation Letter',
      'ISO 55001 Asset Management Certificate',
      'SHEQ Certificate',
      'ECSA Registration',
      'SAIW Certification',
      'Hazardous Substance Handling Certificate',
      'DMR Registration',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal', 'policy'],
  },
  {
    code: 'S26',
    name: 'Municipal and Local Government Suppliers',
    aliases: ['municipal', 'local government', 'mfma', 'epwp', 'salga'],
    standardDocuments: [...CORE_DOCUMENTS, 'COIDA Letter of Good Standing'],
    sectorDocuments: [
      'Municipality Supplier Database Registration',
      'MFMA Compliance Certificate',
      'EPWP Compliance Certificate',
      'Ward Councillor Letter of Support',
      'MSCOA Compatibility Certificate',
      'Local Economic Development Certificate',
      'SALGA Membership',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal'],
  },
  {
    code: 'S27',
    name: 'State-Owned Enterprise Suppliers',
    aliases: ['soe', 'state-owned', 'eskom', 'transnet', 'prasa', 'acsa', 'armscor'],
    standardDocuments: [...CORE_DOCUMENTS, ...STANDARD_INSURANCE_DOCUMENTS],
    sectorDocuments: [
      'Eskom Approved Vendor Certificate and Vendor Number',
      'Transnet Supplier Registration Certificate',
      'PRASA Vendor Registration',
      'Armscor Security Clearance',
      'ACSA Approved Vendor',
      'SANRAL Pre-qualification Certificate',
      'SAFCOL or IDC Supplier Registration',
      'Denel or SAA Approved Vendor Status',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'certification', 'legal'],
  },
  {
    code: 'S28',
    name: 'Research, Strategy, Monitoring and Evaluation',
    aliases: ['research', 'strategy', 'monitoring', 'evaluation', 'samea', 'sarima'],
    standardDocuments: [...CORE_DOCUMENTS, 'Professional Indemnity Insurance'],
    sectorDocuments: [
      'HSRC or CSIR Accreditation',
      'NRF Rating or Research Capacity Statement',
      'University Ethics Clearance Certificate',
      'ISO 9001 Certificate',
      'SANAS Accreditation',
      'Statistics SA Data Partner Agreement',
      'AGSA Evaluation Panel Registration',
      'Professional Body Membership',
    ],
    expectedDocumentGroups: ['registration', 'tax', 'bbbee', 'financial', 'certification', 'legal'],
  },
];

export function getScmSectorForText(value?: string | null): ScmSector | undefined {
  const normalized = (value ?? '').toLowerCase().trim();
  if (!normalized) return undefined;

  return SCM_SECTORS.find((sector) => {
    const haystack = [sector.code, sector.name, ...sector.aliases].join(' ').toLowerCase();
    return haystack.includes(normalized) || sector.aliases.some((alias) => normalized.includes(alias));
  });
}

export function getExpectedDocumentGroupsForSector(value?: string | null): LegacyDocumentCategory[] {
  return getScmSectorForText(value)?.expectedDocumentGroups ?? ['tax', 'bbbee', 'registration', 'financial'];
}
