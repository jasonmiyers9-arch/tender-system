import { getOpenRouterRuntimeConfig } from './aiSettingsService';
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
const FALLBACK_MODEL = 'openai/gpt-oss-120b:free';

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

export function buildTenderRequirementsFromTender(tender: TenderDetail | TenderMatch): TenderRequirements {
  return {
    requiredCategories: tender.required_categories || ['tax', 'registration'],
    preferredCategories: tender.recommendedDocuments || [],
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
  const runtime = await getOpenRouterRuntimeConfig();
  const apiKey = runtime.apiKey;
  const model = runtime.model || FALLBACK_MODEL;

  if (!apiKey) {
    return {
      adjustedScore: deterministicScore,
      llmDeltaApplied: 0,
      confidenceScore: input.deterministic.confidenceScore,
      reasonCodes: ['no_api_key', 'deterministic_fallback'],
      analystSummary: input.deterministic.recommendation,
      model: 'deterministic-fallback',
      promptVersion: ANALYST_PROMPT_VERSION,
      source: 'deterministic',
    };
  }

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

  try {
    const completion = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 350,
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
      }),
    });

    if (!completion.ok) {
      return {
        adjustedScore: deterministicScore,
        llmDeltaApplied: 0,
        confidenceScore: input.deterministic.confidenceScore,
        reasonCodes: ['llm_unavailable', 'deterministic_fallback'],
        analystSummary: input.deterministic.recommendation,
        model,
        promptVersion: ANALYST_PROMPT_VERSION,
        source: 'deterministic',
      };
    }

    const json = (await completion.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim() ?? '';
    const parsed = parseAdjustmentResponse(content);

    if (!parsed) {
      return {
        adjustedScore: deterministicScore,
        llmDeltaApplied: 0,
        confidenceScore: input.deterministic.confidenceScore,
        reasonCodes: ['llm_response_invalid', 'deterministic_fallback'],
        analystSummary: input.deterministic.recommendation,
        model,
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
      model,
      promptVersion: ANALYST_PROMPT_VERSION,
      source: 'hybrid',
    };
  } catch {
    return {
      adjustedScore: deterministicScore,
      llmDeltaApplied: 0,
      confidenceScore: input.deterministic.confidenceScore,
      reasonCodes: ['llm_exception', 'deterministic_fallback'],
      analystSummary: input.deterministic.recommendation,
      model,
      promptVersion: ANALYST_PROMPT_VERSION,
      source: 'deterministic',
    };
  }
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
