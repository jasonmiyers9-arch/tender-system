import { chatWithOpenRouter } from './openRouterClient';
import {
  calculateTenderMatchScore,
  generateComplianceProfile,
  type CompanyComplianceProfile,
  type PriorityAction,
  type TenderMatchScore,
  type TenderRequirements,
} from './complianceScoring';
import {
  createAnalystEvent,
  createAnalystRun,
  listDocumentsForCompany,
  listTenders,
  type AnalystRunRecord,
} from './firestoreService';
import { TENDER_ANALYST_SYSTEM_PROMPT, ANALYST_PROMPT_VERSION } from './aiPrompts';
import type { TenderDetail, TenderMatch } from '@/lib/api/types';

const MAX_ABS_SCORE_DELTA = 10;
type LlmAdjustmentPayload = {
  delta: number;
  confidence: number;
  reasonCodes: string[];
  summary: string;
};

export type HybridAdjustmentReasonCode =
  | 'llm_adjustment_applied'
  | 'llm_adjustment_capped'
  | 'llm_response_invalid'
  | 'llm_unavailable'
  | 'llm_exception'
  | 'deterministic_fallback'
  | 'no_api_key';

export type HybridAdjustmentResult = {
  adjustedScore: number;
  llmDeltaApplied: number;
  confidenceScore: number;
  reasonCodes: HybridAdjustmentReasonCode[];
  analystSummary: string;
  model: string;
  promptVersion: string;
  source: 'hybrid' | 'deterministic';
};

export type RescoreEventType =
  | 'tender.created'
  | 'tender.updated'
  | 'document.uploaded'
  | 'document.verified'
  | 'document.expired'
  | 'document.renewed'
  | 'company.updated'
  | 'company.profile.updated';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function tenderRequirementText(tender: TenderDetail | TenderMatch): string {
  return [
    tender.title,
    tender.category,
    tender.description,
    ...(tender.requirements ?? []),
    ...(tender.eligibilityCriteria ?? []),
    ...(tender.recommendedDocuments ?? []),
    ...(tender.required_categories ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function inferMinBbbeeLevel(text: string): number | undefined {
  const match = text.match(/(?:b-bbee|bbbee|bee)[^\d]{0,30}(?:level|lvl)?\s*([1-8])|(?:level|lvl)\s*([1-8])[^a-z0-9]{0,30}(?:b-bbee|bbbee|bee)/i);
  const level = Number(match?.[1] ?? match?.[2]);
  return level >= 1 && level <= 8 ? level : undefined;
}

function inferMinCidbGrade(text: string): string | undefined {
  const match = text.match(/(?:cidb|contractor grading|grading designation)[^\d]{0,40}(?:grade|grading)?\s*([1-9])\s*(gb|ce|eb|ep|me|so|sq|sn|sb)?/i);
  if (!match?.[1]) return undefined;
  return `Grade ${match[1]}${match[2] ? ` ${match[2].toUpperCase()}` : ''}`;
}

function inferRequiredCertifications(text: string): string[] {
  const certifications = new Set<string>();
  if (/\bcidb\b|contractor grading|grading designation/i.test(text)) certifications.add('CIDB');
  if (/\bnhbrc\b/i.test(text)) certifications.add('NHBRC');
  if (/iso\s*9001|quality management/i.test(text)) certifications.add('ISO 9001');
  if (/iso\s*14001|environmental management/i.test(text)) certifications.add('ISO 14001');
  if (/iso\s*45001|ohsas\s*18001|occupational health|health and safety|\bohs\b/i.test(text)) certifications.add('ISO 45001');
  return [...certifications];
}

export function buildTenderRequirementsFromTender(tender: TenderDetail | TenderMatch): TenderRequirements {
  const text = tenderRequirementText(tender);
  const required = new Set<string>(tender.required_categories?.length ? tender.required_categories : ['tax', 'registration']);
  const preferred = new Set<string>(tender.recommendedDocuments ?? []);

  if (/\bbbbee\b|\bb-bbee\b|\bbee\b|sworn affidavit/i.test(text)) required.add('bbbee');
  if (/\bcidb\b|\bnhbrc\b|iso\s*\d{4,5}|construction|civil works|engineering|quality management|environmental management|health and safety|\bohs\b/i.test(text)) required.add('certification');
  if (/financial statement|annual financial|bank statement|bank confirmation|turnover/i.test(text)) required.add('financial');
  if (/insurance|public liability|professional indemnity|letter of good standing|coida|safety file/i.test(text)) required.add('legal');

  const requiredCertifications = inferRequiredCertifications(text);
  const minBBBEELevel = inferMinBbbeeLevel(text);
  const minCIDBGrade = inferMinCidbGrade(text);
  const requiresCsd = /\bcsd\b|central supplier database|supplier number|supplier registration/i.test(text);

  return {
    requiredCategories: [...required],
    preferredCategories: [...preferred],
    ...(minBBBEELevel ? { minBBBEELevel } : {}),
    ...(minCIDBGrade ? { minCIDBGrade } : {}),
    ...(requiredCertifications.length ? { requiredCertifications } : {}),
    ...(requiresCsd ? { requiresCsd: true } : {}),
  };
}

function parseAdjustmentResponse(content: string): LlmAdjustmentPayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<LlmAdjustmentPayload>;
    if (typeof parsed.delta !== 'number') return null;
    if (typeof parsed.confidence !== 'number') return null;
    if (!Array.isArray(parsed.reasonCodes)) return null;
    if (typeof parsed.summary !== 'string') return null;
    return {
      delta: parsed.delta,
      confidence: clamp(parsed.confidence, 0, 100),
      reasonCodes: parsed.reasonCodes.map((v) => String(v).trim()).filter(Boolean),
      summary: parsed.summary.trim(),
    };
  } catch {
    return null;
  }
}

export async function applyHybridScoreAdjustment(input: {
  deterministic: TenderMatchScore;
  profile: CompanyComplianceProfile;
  requirements: TenderRequirements;
  tenderContext: { id: string; title: string; description?: string; requirements?: string[]; eligibilityCriteria?: string[] };
}): Promise<HybridAdjustmentResult> {
  const deterministicScore = input.deterministic.matchScore;

  const payload = {
    deterministicScore,
    breakdown: input.deterministic.breakdown,
    gaps: input.deterministic.gaps,
    recommendations: input.deterministic.recommendations,
    strengths: input.deterministic.strengths,
    missingDocuments: input.deterministic.missingDocuments,
    priorityActions: input.deterministic.priorityActions,
    profile: {
      overallScore: input.profile.overallScore,
      missingCategories: input.profile.missingCategories,
      expiringDocuments: input.profile.expiringDocuments,
    },
    tender: {
      id: input.tenderContext.id,
      title: input.tenderContext.title,
      description: input.tenderContext.description ?? '',
      requirements: input.tenderContext.requirements ?? [],
      eligibilityCriteria: input.tenderContext.eligibilityCriteria ?? [],
    },
    boundedDelta: {
      min: -MAX_ABS_SCORE_DELTA,
      max: MAX_ABS_SCORE_DELTA,
    },
  };

  const completion = await chatWithOpenRouter({
    temperature: 0.1,
    maxTokens: 350,
    messages: [
      {
        role: 'system',
        content: TENDER_ANALYST_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: JSON.stringify(payload),
      },
    ],
  });

  if (!completion.ok) {
    return {
      adjustedScore: deterministicScore,
      llmDeltaApplied: 0,
      confidenceScore: input.deterministic.confidenceScore,
      reasonCodes: [
        completion.reason === 'no_api_key' ? 'no_api_key' : 'llm_unavailable',
        'deterministic_fallback',
      ],
      analystSummary: input.deterministic.recommendation,
      model: completion.reason === 'no_api_key' ? 'deterministic-fallback' : completion.model,
      promptVersion: ANALYST_PROMPT_VERSION,
      source: 'deterministic',
    };
  }

  const parsed = parseAdjustmentResponse(completion.content);

  if (!parsed) {
    return {
      adjustedScore: deterministicScore,
      llmDeltaApplied: 0,
      confidenceScore: input.deterministic.confidenceScore,
      reasonCodes: ['llm_response_invalid', 'deterministic_fallback'],
      analystSummary: input.deterministic.recommendation,
      model: completion.model,
      promptVersion: ANALYST_PROMPT_VERSION,
      source: 'deterministic',
    };
  }

  const cappedDelta = clamp(parsed.delta, -MAX_ABS_SCORE_DELTA, MAX_ABS_SCORE_DELTA);
  const adjustedScore = clamp(Math.round(deterministicScore + cappedDelta), 0, 100);
  const reasonCodes: HybridAdjustmentReasonCode[] = ['llm_adjustment_applied'];
  if (cappedDelta !== parsed.delta) {
    reasonCodes.push('llm_adjustment_capped');
  }

  return {
    adjustedScore,
    llmDeltaApplied: cappedDelta,
    confidenceScore: Math.round((input.deterministic.confidenceScore * 0.7) + (parsed.confidence * 0.3)),
    reasonCodes,
    analystSummary: parsed.summary || input.deterministic.recommendation,
    model: completion.model,
    promptVersion: ANALYST_PROMPT_VERSION,
    source: 'hybrid',
  };
}

function mapSeverityToPriorityScore(action: PriorityAction): number {
  if (action.severity === 'critical') return 1;
  if (action.severity === 'major') return 2;
  return 3;
}

function mapToAnalystRunRecord(input: {
  companyId: string;
  tenderId: string;
  tenderTitle: string;
  trigger: string;
  actorUserId?: string;
  result: TenderMatchScore;
  hybrid: HybridAdjustmentResult;
  profile: CompanyComplianceProfile;
}): Omit<AnalystRunRecord, 'id' | 'createdAt'> {
  return {
    companyId: input.companyId,
    tenderId: input.tenderId,
    tenderTitle: input.tenderTitle,
    trigger: input.trigger,
    actorUserId: input.actorUserId ?? null,
    score: input.hybrid.adjustedScore,
    deterministicScore: input.result.matchScore,
    llmDeltaApplied: input.hybrid.llmDeltaApplied,
    confidenceScore: input.hybrid.confidenceScore,
    reasonCodes: input.hybrid.reasonCodes,
    recommendation: input.result.recommendation,
    missingDocuments: input.result.missingDocuments,
    strengths: input.result.strengths,
    priorityActions: input.result.priorityActions
      .slice(0, 5)
      .map((action) => `${action.title} (P${mapSeverityToPriorityScore(action)} / ETA ${action.etaDays}d)`),
    breakdown: input.result.breakdown,
    source: input.hybrid.source,
    model: input.hybrid.model,
    promptVersion: input.hybrid.promptVersion,
    companyProfileSnapshot: {
      overallScore: input.profile.overallScore,
      documentCount: input.profile.documentCount,
      missingCategories: input.profile.missingCategories,
      expiringDocuments: input.profile.expiringDocuments,
      categoryScores: input.profile.categoryScores,
      recommendations: input.profile.recommendations,
    },
  };
}

export async function persistAnalystRun(input: {
  companyId: string;
  tenderId: string;
  tenderTitle: string;
  trigger: string;
  actorUserId?: string;
  result: TenderMatchScore;
  hybrid: HybridAdjustmentResult;
  profile: CompanyComplianceProfile;
}): Promise<void> {
  await createAnalystRun(mapToAnalystRunRecord(input));
}

export async function publishRescoreEvent(input: {
  eventType: RescoreEventType;
  companyId: string;
  actorUserId?: string;
  tenderId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createAnalystEvent({
    eventType: input.eventType,
    companyId: input.companyId,
    tenderId: input.tenderId ?? null,
    actorUserId: input.actorUserId ?? null,
    metadata: input.metadata ?? {},
  });

  // Fire-and-forget immediate rescore pass (interim until durable backend worker takes over).
  setTimeout(() => {
    void runAutoRescoreForCompany({
      companyId: input.companyId,
      trigger: input.eventType,
      actorUserId: input.actorUserId,
      tenderId: input.tenderId,
    });
  }, 0);
}

export async function runAutoRescoreForCompany(input: {
  companyId: string;
  trigger: string;
  actorUserId?: string;
  tenderId?: string;
}): Promise<void> {
  const [documents, tenders] = await Promise.all([
    listDocumentsForCompany(input.companyId),
    listTenders(),
  ]);

  const profile = generateComplianceProfile(input.companyId, documents);
  const candidateTenders = tenders
    .filter((tender) => tender.status === 'published')
    .filter((tender) => (input.tenderId ? tender.id === input.tenderId : true));

  for (const tender of candidateTenders) {
    const requirements = buildTenderRequirementsFromTender(tender);
    const deterministic = calculateTenderMatchScore(
      input.companyId,
      tender.id,
      tender.title,
      profile,
      requirements,
    );

    const hybrid = await applyHybridScoreAdjustment({
      deterministic,
      profile,
      requirements,
      tenderContext: {
        id: tender.id,
        title: tender.title,
        description: tender.description,
        requirements: tender.requirements,
        eligibilityCriteria: tender.eligibilityCriteria,
      },
    });

    await persistAnalystRun({
      companyId: input.companyId,
      tenderId: tender.id,
      tenderTitle: tender.title,
      trigger: input.trigger,
      actorUserId: input.actorUserId,
      result: deterministic,
      hybrid,
      profile,
    });
  }
}
