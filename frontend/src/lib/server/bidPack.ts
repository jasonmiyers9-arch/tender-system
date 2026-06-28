import type { Company, TenderDetail } from '@/lib/api/types';
import type { InternalDocument } from './mockData';
import type { ScrapedTender } from './tenderScraper';
import {
  calculateTenderMatchScore,
  generateComplianceProfile,
  type TenderMatchScore,
  type TenderRequirements,
} from './complianceScoring';
import { inferRequiredCategoriesFromTenderText } from './tenderResolver';

export interface BidPackAlert {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
}

export interface BidPackDocumentItem {
  category: string;
  required: boolean;
  status: 'ready' | 'missing' | 'needs_verification' | 'expired';
  documentName: string | null;
  action: string;
}

export interface BidPackResult {
  tender: TenderDetail;
  company: Company;
  fit: {
    label: 'Good fit' | 'Risky' | 'Do not apply';
    score: number;
    eligible: boolean;
    confidence: number;
    reason: string;
  };
  alerts: BidPackAlert[];
  actions: Array<{ title: string; severity: string; etaDays: number; reason: string }>;
  documents: BidPackDocumentItem[];
  sourceDocuments: Array<{ filename: string; url: string; extractionStatus: string; pageCount: number }>;
  sbdPackUrl: string;
  generatedAt: string;
}

function parseTenderDate(value: string | null | undefined): Date | null {
  if (!value || value === 'Not specified') return null;
  const parsed = new Date(value.replace(/\//g, '-'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysUntil(value: string | null | undefined): number | null {
  const date = parseTenderDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function inferRequirements(tender: TenderDetail, scrapedTender?: ScrapedTender | null): TenderRequirements {
  const requiredCategories = tender.required_categories?.length
    ? tender.required_categories
    : inferRequiredCategoriesFromTenderText([
        tender.title,
        tender.description,
        tender.specialConditions,
        ...(tender.requirements ?? []),
        ...(tender.eligibilityCriteria ?? []),
        scrapedTender?.fullText,
      ].filter(Boolean).join(' '));

  return {
    requiredCategories,
    preferredCategories: tender.recommendedDocuments?.filter((item) => !requiredCategories.includes(item)) ?? [],
    requiresCsd: /\bcsd\b|central supplier database|supplier number/i.test([
      tender.title,
      tender.description,
      tender.specialConditions,
      scrapedTender?.fullText,
    ].filter(Boolean).join(' ')),
  };
}

function fitLabel(score: TenderMatchScore): BidPackResult['fit']['label'] {
  if (!score.isEligible || score.matchScore < 50 || score.gaps.some((gap) => gap.severity === 'critical')) {
    return 'Do not apply';
  }
  if (score.matchScore < 80 || score.gaps.length > 0) return 'Risky';
  return 'Good fit';
}

function buildAlerts(tender: TenderDetail, score: TenderMatchScore): BidPackAlert[] {
  const alerts: BidPackAlert[] = [];
  const closingDays = daysUntil(tender.deadline);
  if (closingDays !== null) {
    if (closingDays < 0) {
      alerts.push({ severity: 'critical', title: 'Tender closed', detail: `Closing date passed ${Math.abs(closingDays)} day(s) ago.` });
    } else if (closingDays <= 2) {
      alerts.push({ severity: 'critical', title: 'Closing deadline is urgent', detail: `Submit within ${closingDays} day(s), preferably before the final day.` });
    } else if (closingDays <= 7) {
      alerts.push({ severity: 'warning', title: 'Closing deadline is near', detail: `${closingDays} day(s) remain before closing.` });
    } else {
      alerts.push({ severity: 'info', title: 'Closing deadline tracked', detail: `${closingDays} day(s) remain before closing.` });
    }
  }

  if (tender.briefing?.hasBriefingSession) {
    const briefingDays = daysUntil(tender.briefing.date);
    const severity = tender.briefing.isCompulsory ? 'critical' : 'warning';
    alerts.push({
      severity,
      title: tender.briefing.isCompulsory ? 'Compulsory briefing required' : 'Briefing session available',
      detail: `${tender.briefing.date || 'Date not captured'}${tender.briefing.venue ? ` at ${tender.briefing.venue}` : ''}${briefingDays !== null ? ` (${briefingDays} day(s) away)` : ''}.`,
    });
  }

  for (const evidence of score.evidence) {
    if (evidence.expiryDate) {
      const expiryDays = daysUntil(evidence.expiryDate);
      if (expiryDays !== null && expiryDays >= 0 && expiryDays <= 14) {
        alerts.push({
          severity: expiryDays <= 7 ? 'critical' : 'warning',
          title: 'Document expires before or near submission',
          detail: `${evidence.documentName ?? evidence.category} expires in ${expiryDays} day(s).`,
        });
      }
    }
  }

  return alerts;
}

function buildDocumentItems(score: TenderMatchScore): BidPackDocumentItem[] {
  return score.evidence.map((evidence) => {
    let status: BidPackDocumentItem['status'] = 'ready';
    if (!evidence.matched) status = 'missing';
    else if (!evidence.valid) status = 'expired';
    else if (!evidence.verified) status = 'needs_verification';

    const action = status === 'ready'
      ? 'Attach to the submission pack'
      : status === 'missing'
        ? `Upload a valid ${evidence.category.toUpperCase()} document`
        : status === 'expired'
          ? `Renew ${evidence.documentName ?? evidence.category} before submission`
          : `Request verification for ${evidence.documentName ?? evidence.category}`;

    return {
      category: evidence.category,
      required: true,
      status,
      documentName: evidence.documentName,
      action,
    };
  });
}

export function buildBidPack(input: {
  company: Company;
  tender: TenderDetail;
  documents: InternalDocument[];
  scrapedTender?: ScrapedTender | null;
}): BidPackResult {
  const requirements = inferRequirements(input.tender, input.scrapedTender);
  const profile = generateComplianceProfile(input.company.id, input.documents);
  const score = calculateTenderMatchScore(
    input.company.id,
    input.tender.id,
    input.tender.title,
    profile,
    requirements,
  );
  const label = fitLabel(score);

  return {
    tender: input.tender,
    company: input.company,
    fit: {
      label,
      score: score.matchScore,
      eligible: score.isEligible,
      confidence: score.confidenceScore,
      reason: score.recommendation,
    },
    alerts: buildAlerts(input.tender, score),
    actions: score.priorityActions,
    documents: buildDocumentItems(score),
    sourceDocuments: (input.scrapedTender?.documents ?? []).map((document) => ({
      filename: document.filename,
      url: document.url,
      extractionStatus: document.extractionStatus,
      pageCount: document.pageCount,
    })),
    sbdPackUrl: `/api/sbd-forms?tenderId=${encodeURIComponent(input.tender.id)}`,
    generatedAt: new Date().toISOString(),
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderBidPackHtml(pack: BidPackResult): string {
  const docRows = pack.documents.map((document) => `
    <tr>
      <td>${escapeHtml(document.category.toUpperCase())}</td>
      <td>${escapeHtml(document.status)}</td>
      <td>${escapeHtml(document.documentName ?? 'Not available')}</td>
      <td>${escapeHtml(document.action)}</td>
    </tr>
  `).join('');
  const alerts = pack.alerts.map((alert) => `<li><strong>${escapeHtml(alert.title)}:</strong> ${escapeHtml(alert.detail)}</li>`).join('');
  const actions = pack.actions.map((action) => `<li><strong>${escapeHtml(action.title)}</strong> - ${escapeHtml(action.reason)} (${escapeHtml(action.etaDays)} day target)</li>`).join('');
  const sourceDocs = pack.sourceDocuments.length
    ? pack.sourceDocuments.map((document) => `<li>${escapeHtml(document.filename || 'Tender PDF')} - ${escapeHtml(document.url || 'No URL captured')}</li>`).join('')
    : '<li>No source tender PDFs captured.</li>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(pack.company.name)} Bid Pack</title>
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #f3f4f6; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 20px; }
    section { background: #fff; border: 1px solid #d1d5db; padding: 24px; margin-bottom: 18px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 0 0 14px; font-size: 18px; }
    .fit { display: inline-block; padding: 8px 12px; border: 1px solid #111827; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 9px; text-align: left; vertical-align: top; }
    ul { margin: 0; padding-left: 18px; line-height: 1.6; }
    .meta { color: #4b5563; font-size: 13px; line-height: 1.5; }
    @media print { body { background: #fff; } main { padding: 0; } section { border: none; page-break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>Tender Guard Pro Bid Pack</h1>
      <p class="meta">
        Company: ${escapeHtml(pack.company.name)}<br />
        Tender: ${escapeHtml(pack.tender.title)}<br />
        Buyer: ${escapeHtml(pack.tender.organization)}<br />
        Closing date: ${escapeHtml(pack.tender.deadline)}<br />
        Generated: ${escapeHtml(pack.generatedAt)}
      </p>
      <p class="fit">${escapeHtml(pack.fit.label)} - ${escapeHtml(pack.fit.score)}/100 fit, ${escapeHtml(pack.fit.confidence)}% evidence confidence</p>
      <p>${escapeHtml(pack.fit.reason)}</p>
    </section>
    <section><h2>Deadline and Briefing Alerts</h2><ul>${alerts || '<li>No immediate deadline alerts.</li>'}</ul></section>
    <section><h2>Priority Actions</h2><ul>${actions || '<li>No priority actions. Review and submit the pack.</li>'}</ul></section>
    <section>
      <h2>Submission Documents</h2>
      <table><thead><tr><th>Category</th><th>Status</th><th>Document</th><th>Action</th></tr></thead><tbody>${docRows}</tbody></table>
    </section>
    <section><h2>Matched Tender Source PDFs</h2><ul>${sourceDocs}</ul></section>
  </main>
</body>
</html>`;
}

export function bidPackFilename(companyName: string, tenderTitle: string): string {
  const clean = `${companyName}-${tenderTitle}-bid-pack`
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${clean || 'bid-pack'}.html`;
}
