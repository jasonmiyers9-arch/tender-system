// ─────────────────────────────────────────────
// South African Tender Categories
// Based on eTenders.gov.za and SA Government classifications
// ─────────────────────────────────────────────

export const TENDER_CATEGORIES = [
  'Construction',
  'Infrastructure & Civil Works',
  'IT & Technology',
  'Professional Services',
  'Consulting',
  'Financial Services',
  'Healthcare & Medical',
  'Education & Training',
  'Transport & Logistics',
  'Security Services',
  'Cleaning & Waste Management',
  'Catering & Food Services',
  'Supplies: General',
  'Supplies: Computer Equipment',
  'Supplies: Electrical Equipment',
  'Supplies: Medical Equipment',
  'Agricultural & Farming',
  'Mining & Resources',
  'Energy & Power',
  'Water & Sanitation',
  'Telecommunications',
  'Legal Services',
  'Facilities Management',
  'Printing & Stationery',
  'Advertising & Media',
  'Research & Development',
  'Environmental Services',
  'Manufacturing',
  'Rental & Leasing',
  'Maintenance & Repairs',
  'Social Services',
  'Tourism & Hospitality',
  'Engineering Services',
  'Other',
] as const;

export type TenderCategory = (typeof TENDER_CATEGORIES)[number];

/**
 * Map scraped category text to our standard categories
 */
export function normalizeTenderCategory(raw: string): TenderCategory {
  const lower = raw.toLowerCase().trim();

  if (lower.includes('construct') || lower.includes('building') || lower.includes('civil')) {
    return 'Construction';
  }
  if (lower.includes('infrastructure')) return 'Infrastructure & Civil Works';
  if (lower.includes('computer') || lower.includes('laptop') || lower.includes('software') || lower.includes('ict')) {
    return 'IT & Technology';
  }
  if (lower.includes('information and communication') || lower.includes('telecomm')) {
    return 'Telecommunications';
  }
  if (lower.includes('professional')) return 'Professional Services';
  if (lower.includes('consult')) return 'Consulting';
  if (lower.includes('financ') || lower.includes('accounting') || lower.includes('audit')) {
    return 'Financial Services';
  }
  if (lower.includes('health') || lower.includes('medical') || lower.includes('pharma')) {
    return 'Healthcare & Medical';
  }
  if (lower.includes('educat') || lower.includes('training')) return 'Education & Training';
  if (lower.includes('transport') || lower.includes('logistics') || lower.includes('fleet')) {
    return 'Transport & Logistics';
  }
  if (lower.includes('security') || lower.includes('guard')) return 'Security Services';
  if (lower.includes('clean') || lower.includes('waste') || lower.includes('sanit')) {
    return 'Cleaning & Waste Management';
  }
  if (lower.includes('cater') || lower.includes('food')) return 'Catering & Food Services';
  if (lower.includes('electrical')) return 'Supplies: Electrical Equipment';
  if (lower.includes('medical') && lower.includes('supplies')) return 'Supplies: Medical Equipment';
  if (lower.includes('supplies') || lower.includes('delivery') || lower.includes('supply')) {
    return 'Supplies: General';
  }
  if (lower.includes('agricul') || lower.includes('farm')) return 'Agricultural & Farming';
  if (lower.includes('mining')) return 'Mining & Resources';
  if (lower.includes('energy') || lower.includes('power') || lower.includes('electri')) {
    return 'Energy & Power';
  }
  if (lower.includes('water')) return 'Water & Sanitation';
  if (lower.includes('legal') || lower.includes('law')) return 'Legal Services';
  if (lower.includes('facilit')) return 'Facilities Management';
  if (lower.includes('print') || lower.includes('stationery')) return 'Printing & Stationery';
  if (lower.includes('advertis') || lower.includes('media') || lower.includes('marketing')) {
    return 'Advertising & Media';
  }
  if (lower.includes('research')) return 'Research & Development';
  if (lower.includes('environment')) return 'Environmental Services';
  if (lower.includes('manufactur')) return 'Manufacturing';
  if (lower.includes('rental') || lower.includes('lease')) return 'Rental & Leasing';
  if (lower.includes('mainten') || lower.includes('repair')) return 'Maintenance & Repairs';
  if (lower.includes('social')) return 'Social Services';
  if (lower.includes('tourism') || lower.includes('hospitality')) return 'Tourism & Hospitality';
  if (lower.includes('engineer')) return 'Engineering Services';

  return 'Other';
}
