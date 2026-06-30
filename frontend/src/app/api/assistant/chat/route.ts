import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import {
  ensureUserCompanyContext,
  getCompanyById,
  getTenderById,
  listCompaniesForUser,
  listDocumentsForCompany,
} from '@/lib/server/firestoreService';
import { requireRole } from '@/lib/server/apiAuth';
import { buildTenderRequirementsFromTender } from '@/lib/server/analystEngine';
import { calculateTenderMatchScore, generateComplianceProfile } from '@/lib/server/complianceScoring';
import { buildComplianceAdvisorSystemPrompt } from '@/lib/server/aiPrompts';
import { tenderFitScore } from '@/lib/server/tenderScoring';
import { chatWithOpenRouter, describeAiFailure } from '@/lib/server/openRouterClient';
import { resolveStoredTenderDocuments, fetchTenderDocumentsForAi } from '@/lib/server/tenderSourceDocuments';
import { rateLimit, RateLimits } from '@/lib/server/rateLimiter';
import { getScrapedTenders, type ScrapedTender } from '@/lib/server/tenderScraper';
import type { TenderDetail } from '@/lib/api/types';
import type { TenderRequirements } from '@/lib/server/complianceScoring';

// The advisor fetches a tender's official PDFs and sends them to Claude for
// multimodal reading, which can exceed the default serverless timeout. Allow the
// full Netlify Pro execution budget so the request finishes instead of the
// function being killed mid-request (which the browser sees as a bare 500).
export const maxDuration = 26;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function scrapedTenderId(tender: ScrapedTender): string {
  const raw = `${tender.sourceSite}|${tender.tenderNumber || tender.referenceNumber || tender.title}|${tender.deadline}`;
  return `scraped-${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
}

function inferScrapedRequirements(tender: ScrapedTender): TenderRequirements {
  const text = [
    tender.category,
    tender.rawCategory,
    tender.title,
    tender.description,
    tender.specialConditions,
    tender.fullText,
    ...(tender.requirements ?? []),
    ...(tender.eligibilityCriteria ?? []),
  ].join(' ').toLowerCase();
  const required = new Set<string>(['tax', 'registration']);
  const preferred = new Set<string>();

  if (/\bbbbee\b|\bb-bbee\b|\bbee\b|sworn affidavit/.test(text)) required.add('bbbee');
  if (/\bcidb\b|construction|civil works|engineering/.test(text)) required.add('certification');
  if (/financial statement|annual financial|bank statement|bank confirmation|turnover/.test(text)) required.add('financial');
  if (/insurance|public liability|professional indemnity|letter of good standing|coida|safety file/.test(text)) required.add('legal');
  if (/iso|quality management|environmental|health and safety|ohs/.test(text)) preferred.add('certification');

  return { requiredCategories: [...required], preferredCategories: [...preferred] };
}

async function resolveTender(tenderId: string): Promise<TenderDetail | null> {
  const storedTender = await getTenderById(tenderId);
  if (storedTender) return storedTender.status === 'published' ? storedTender : null;

  const scraped = (await getScrapedTenders()).find((tender) => scrapedTenderId(tender) === tenderId);
  if (!scraped) return null;
  const requirements = inferScrapedRequirements(scraped);

  return {
    id: tenderId,
    title: scraped.title,
    organization: scraped.organOfState || scraped.organization || 'Unknown department',
    deadline: scraped.deadline || scraped.closingDate || 'Not specified',
    value: scraped.value || 'Not specified',
    matchScore: 0,
    readinessScore: 0,
    gaps: [],
    category: scraped.category,
    location: scraped.deliveryLocation || scraped.location || scraped.province || 'Not specified',
    description: scraped.description || scraped.specialConditions || scraped.title,
    requirements: scraped.requirements ?? [],
    eligibilityCriteria: scraped.eligibilityCriteria ?? [],
    required_categories: requirements.requiredCategories,
    recommendedDocuments: requirements.preferredCategories,
    tenderNumber: scraped.tenderNumber || scraped.referenceNumber,
    sourceUrl: scraped.sourceUrl,
    sourceSite: scraped.sourceSite,
    isScraped: true,
    status: 'published',
  };
}

function sanitizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false;
      const message = item as Partial<ChatMessage>;
      return (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string';
    })
    .slice(-8)
    .map((message) => ({ ...message, content: message.content.trim().slice(0, 2_000) }))
    .filter((message) => message.content.length > 0);
}

export async function POST(req: Request) {
  const rateLimitError = await rateLimit(req, RateLimits.ai);
  if (rateLimitError) return rateLimitError;

  const { user, error } = await requireRole(req, ['user']);
  if (error) return error;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const question = String(body.question ?? '').trim().slice(0, 2_000);
  const tenderId = String(body.tenderId ?? '').trim();
  const history = sanitizeHistory(body.messages);

  if (!question) return NextResponse.json({ detail: 'question is required' }, { status: 400 });

  let companyId = user!.activeCompanyId ?? user!.companyId;
  if (!companyId) companyId = (await listCompaniesForUser(user!.id))[0]?.id ?? null;
  if (!companyId) companyId = (await ensureUserCompanyContext(user!.id))?.id ?? null;
  if (!companyId) return NextResponse.json({ detail: 'Company context required' }, { status: 400 });

  const [company, documents, tender] = await Promise.all([
    getCompanyById(companyId),
    listDocumentsForCompany(companyId),
    tenderId ? resolveTender(tenderId) : Promise.resolve(null),
  ]);

  if (tenderId && !tender) return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });

  const profile = generateComplianceProfile(companyId, documents);
  const requirements = tender ? buildTenderRequirementsFromTender(tender) : null;
  const tenderScore = tender && requirements
    ? calculateTenderMatchScore(companyId, tender.id, tender.title, profile, requirements)
    : null;

  // Company-aware fit score, identical to the badge the user clicked on, so the
  // advisor and the tender match list never disagree.
  const tenderReadinessScore = tender && tenderScore
    ? tenderFitScore({
        matchScore: tenderScore.matchScore,
        hasGaps: tenderScore.missingDocuments.length > 0,
        tenderCategory: tender.category,
        companyCategories: company?.tenderCategories ?? [],
        tenderText: [
          tender.description,
          ...(tender.requirements ?? []),
          ...(tender.eligibilityCriteria ?? []),
          ...(tender.required_categories ?? []),
        ].filter(Boolean).join(' '),
      })
    : null;

  // Pull the tender's official published PDF documents (when available) so the AI
  // reads the real requirements and checks them against the company's compliance
  // documents, rather than relying on scraped summary text alone.
  const tenderSourceDocuments = tender ? await resolveStoredTenderDocuments(tender) : [];
  const tenderAiDocuments = tenderSourceDocuments.length
    ? await fetchTenderDocumentsForAi(tenderSourceDocuments)
    : [];

  const facts = {
    company: {
      name: company?.name ?? 'Company',
      industry: company?.industry ?? '',
      province: company?.province ?? '',
      bbbeeLevel: company?.bbbeeLevel ?? null,
      cidbGrade: company?.cidbGrade ?? null,
    },
    compliance: {
      overallScore: profile.overallScore,
      documentCount: profile.documentCount,
      categoryScores: profile.categoryScores,
      missingCategories: profile.missingCategories,
      expiringDocuments: profile.expiringDocuments,
      recommendations: profile.recommendations,
    },
    documents: documents.map((document) => ({
      name: document.name,
      category: document.category,
      status: document.status,
      expiryDate: document.expiryDate ?? null,
      summary: document.aiSummary?.slice(0, 500) ?? null,
    })),
    tender: tender && tenderScore && requirements ? {
      id: tender.id,
      title: tender.title,
      organization: tender.organization,
      deadline: tender.deadline,
      closingTime: tender.closingTime ?? null,
      value: tender.value ?? null,
      province: tender.province ?? tender.location ?? null,
      category: tender.category,
      description: tender.description,
      briefing: tender.briefing ?? null,
      sourceUrl: tender.sourceUrl ?? null,
      requirements: tender.requirements,
      eligibilityCriteria: tender.eligibilityCriteria,
      requiredDocumentCategories: requirements.requiredCategories,
      preferredDocumentCategories: requirements.preferredCategories,
      minBBBEELevel: requirements.minBBBEELevel ?? null,
      minCIDBGrade: requirements.minCIDBGrade ?? null,
      requiredCertifications: requirements.requiredCertifications ?? [],
      matchScore: tenderReadinessScore ?? tenderScore.matchScore,
      complianceMatchScore: tenderScore.matchScore,
      confidenceScore: tenderScore.confidenceScore,
      isEligible: tenderScore.isEligible,
      missingDocuments: tenderScore.missingDocuments,
      gaps: tenderScore.gaps,
      strengths: tenderScore.strengths,
      priorityActions: tenderScore.priorityActions,
      evidence: tenderScore.evidence,
      recommendation: tenderScore.recommendation,
      officialDocumentsAttached: tenderAiDocuments.map((doc) => doc.filename),
    } : null,
  };

  const completion = await chatWithOpenRouter({
    temperature: 0.15,
    maxTokens: 900,
    messages: [
      {
        role: 'system',
        content: buildComplianceAdvisorSystemPrompt(JSON.stringify(facts), tenderAiDocuments.length > 0),
      },
      ...history,
      { role: 'user', content: question },
    ],
    attachments: tenderAiDocuments.length
      ? tenderAiDocuments.map(({ mimeType, data }) => ({ mimeType, data }))
      : undefined,
  });

  const normalizedQuestion = question.toLowerCase();
  const asksAboutTenderPurpose = Boolean(tender) && /what(?:\s+is|'s).*tender|tender.*(?:about|for|purpose)/i.test(normalizedQuestion);
  const asksAboutDeadline = Boolean(tender) && /when|deadline|closing|close|bidding date|bid date/i.test(normalizedQuestion);
  const fallbackAnswer = tender && asksAboutTenderPurpose
    ? [
        `This tender is for ${tender.title}.`,
        tender.description || `It was published by ${tender.organization}.`,
        `The issuing organization is ${tender.organization}, and the closing date is ${tender.deadline}.`,
      ].join('\n\n')
    : tender && asksAboutDeadline
      ? `The closing date for “${tender.title}” is ${tender.deadline}. Check the tender notice before submitting in case the buyer publishes an amendment.`
      : tenderScore && tender
    ? [
        `Your overall company compliance score is ${profile.overallScore}%. Your match score for “${tender.title}” is ${tenderReadinessScore ?? tenderScore.matchScore}%.`,
        tenderScore.isEligible
          ? 'Verdict: the rules-based assessment currently marks you as ELIGIBLE to bid.'
          : 'Verdict: the rules-based assessment marks you as NOT YET ELIGIBLE — clear the blockers below first.',
        tenderScore.priorityActions.length
          ? 'What to fix to secure this tender:\n' + tenderScore.priorityActions
              .slice(0, 6)
              .map((action) => `• ${action.title} (target ${action.etaDays} day${action.etaDays === 1 ? '' : 's'} — ${action.reason})`)
              .join('\n')
          : (tenderScore.missingDocuments.length
              ? `Missing or unsupported document evidence: ${tenderScore.missingDocuments.join(', ')}.`
              : 'Uploaded company documents support the required tender evidence categories.'),
        tenderScore.strengths.length ? 'Strengths in your favour:\n' + tenderScore.strengths.map((item) => `• ${item}`).join('\n') : '',
        `Deadline: “${tender.title}” closes ${tender.deadline}${tender.closingTime ? ` at ${tender.closingTime}` : ''}.` +
          (tender.briefing?.hasBriefingSession
            ? ` A${tender.briefing.isCompulsory ? ' COMPULSORY' : ''} briefing is scheduled${tender.briefing.date ? ` on ${tender.briefing.date}` : ''}${tender.briefing.venue ? ` at ${tender.briefing.venue}` : ''}.`
            : ''),
        tenderScore.recommendation,
        'This is a readiness assessment, not a guarantee of award — evaluation also depends on price and competitors.',
      ].filter(Boolean).join('\n\n')
    : [
        `Your current compliance score is ${profile.overallScore}%.`,
        profile.missingCategories.length ? `Missing categories: ${profile.missingCategories.join(', ')}.` : 'No required compliance categories are currently missing.',
        profile.recommendations[0] ?? 'Keep your uploaded documents valid and up to date.',
        'Select a tender for a tender-specific match score and action plan.',
      ].join('\n\n');

  if (!completion.ok && completion.reason !== 'no_api_key') {
    console.warn('Compliance assistant fallback:', completion);
  }

  return NextResponse.json({
    answer: completion.ok ? completion.content : fallbackAnswer,
    source: completion.ok ? 'claude' : 'deterministic-fallback',
    model: completion.ok ? completion.model : 'rules-based',
    aiWarning: completion.ok ? null : describeAiFailure(completion),
    snapshot: {
      overallScore: profile.overallScore,
      tenderId: tender?.id ?? null,
      tenderTitle: tender?.title ?? null,
      tenderMatchScore: tenderReadinessScore ?? tenderScore?.matchScore ?? null,
      isEligible: tenderScore?.isEligible ?? null,
      missingDocuments: tenderScore?.missingDocuments ?? profile.missingCategories,
    },
  });
}
