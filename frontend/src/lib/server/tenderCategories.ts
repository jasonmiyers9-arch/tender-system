// ─────────────────────────────────────────────
// South African Tender Categories
// Based on eTenders.gov.za and SA Government classifications
// ─────────────────────────────────────────────

import { getScmSectorForText } from '@/lib/scmIntelligence';

export const TENDER_CATEGORIES = [
  'Construction and Civil Engineering',
  'Roads, Bridges and Infrastructure',
  'Electrical Engineering and Energy',
  'Mechanical and Plant Engineering',
  'Information and Communications Technology',
  'Software Development and Systems Integration',
  'Skills Development, Training and Education',
  'Healthcare, Medical Supplies and Pharmaceutical',
  'Security Services and Investigations',
  'Cleaning, Hygiene and Facilities Management',
  'Transport, Logistics and Fleet Management',
  'Environmental Services and Waste Management',
  'Property, Real Estate and Valuation',
  'Financial, Accounting and Audit Services',
  'Legal Services',
  'Supply, Delivery and Distribution',
  'Emergency, Disaster Management and Health and Safety',
  'Catering, Food Services and Hospitality',
  'Media, Communications, Advertising and Marketing',
  'Printing, Stationery and Office Supplies',
  'Mining, Resources and Geology',
  'Agriculture, Food Production and Veterinary',
  'Manufacturing and Industrial',
  'Human Resources, Staffing and Employee Wellness',
  'Maintenance, Repair and Asset Management',
  'Municipal and Local Government Suppliers',
  'State-Owned Enterprise Suppliers',
  'Research, Strategy, Monitoring and Evaluation',
  'Other',
] as const;

export type TenderCategory = (typeof TENDER_CATEGORIES)[number];

/**
 * Map scraped category text to our standard categories
 */
export function normalizeTenderCategory(raw: string): TenderCategory {
  const lower = raw.toLowerCase().trim();
  const scmSector = getScmSectorForText(lower);
  if (scmSector) return scmSector.name as TenderCategory;

  if (lower.includes('construct') || lower.includes('building') || lower.includes('civil')) {
    return 'Construction and Civil Engineering';
  }
  if (lower.includes('infrastructure')) return 'Roads, Bridges and Infrastructure';
  if (
    lower === 'it' ||
    lower.startsWith('it ') ||
    lower.includes(' it ') ||
    lower.includes('computer') ||
    lower.includes('laptop') ||
    lower.includes('software') ||
    lower.includes('ict') ||
    lower.includes('information technology') ||
    lower.includes('technology') ||
    lower.includes('digital') ||
    lower.includes('network') ||
    lower.includes('server') ||
    lower.includes('hardware') ||
    lower.includes('data') ||
    lower.includes('cyber') ||
    lower.includes('system')
  ) {
    return 'Information and Communications Technology';
  }
  if (lower.includes('information and communication') || lower.includes('telecomm')) {
    return 'Information and Communications Technology';
  }
  if (lower.includes('professional')) return 'Research, Strategy, Monitoring and Evaluation';
  if (lower.includes('consult')) return 'Research, Strategy, Monitoring and Evaluation';
  if (lower.includes('financ') || lower.includes('accounting') || lower.includes('audit')) {
    return 'Financial, Accounting and Audit Services';
  }
  if (lower.includes('health') || lower.includes('medical') || lower.includes('pharma')) {
    return 'Healthcare, Medical Supplies and Pharmaceutical';
  }
  if (lower.includes('educat') || lower.includes('training')) return 'Skills Development, Training and Education';
  if (lower.includes('transport') || lower.includes('logistics') || lower.includes('fleet')) {
    return 'Transport, Logistics and Fleet Management';
  }
  if (lower.includes('security') || lower.includes('guard')) return 'Security Services and Investigations';
  if (lower.includes('clean') || lower.includes('waste') || lower.includes('sanit')) {
    return lower.includes('waste') ? 'Environmental Services and Waste Management' : 'Cleaning, Hygiene and Facilities Management';
  }
  if (lower.includes('cater') || lower.includes('food')) return 'Catering, Food Services and Hospitality';
  if (lower.includes('electrical')) return 'Electrical Engineering and Energy';
  if (lower.includes('medical') && lower.includes('supplies')) return 'Healthcare, Medical Supplies and Pharmaceutical';
  if (lower.includes('supplies') || lower.includes('delivery') || lower.includes('supply')) {
    return 'Supply, Delivery and Distribution';
  }
  if (lower.includes('agricul') || lower.includes('farm')) return 'Agriculture, Food Production and Veterinary';
  if (lower.includes('mining')) return 'Mining, Resources and Geology';
  if (lower.includes('energy') || lower.includes('power') || lower.includes('electri')) {
    return 'Electrical Engineering and Energy';
  }
  if (lower.includes('water')) return 'Environmental Services and Waste Management';
  if (lower.includes('legal') || lower.includes('law')) return 'Legal Services';
  if (lower.includes('facilit')) return 'Cleaning, Hygiene and Facilities Management';
  if (lower.includes('print') || lower.includes('stationery')) return 'Printing, Stationery and Office Supplies';
  if (lower.includes('advertis') || lower.includes('media') || lower.includes('marketing')) {
    return 'Media, Communications, Advertising and Marketing';
  }
  if (lower.includes('research')) return 'Research, Strategy, Monitoring and Evaluation';
  if (lower.includes('environment')) return 'Environmental Services and Waste Management';
  if (lower.includes('manufactur')) return 'Manufacturing and Industrial';
  if (lower.includes('rental') || lower.includes('lease')) return 'Property, Real Estate and Valuation';
  if (lower.includes('mainten') || lower.includes('repair')) return 'Maintenance, Repair and Asset Management';
  if (lower.includes('social')) return 'Human Resources, Staffing and Employee Wellness';
  if (lower.includes('tourism') || lower.includes('hospitality')) return 'Catering, Food Services and Hospitality';
  if (lower.includes('engineer')) return 'Mechanical and Plant Engineering';

  return 'Other';
}
