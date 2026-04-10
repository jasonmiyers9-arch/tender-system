import { NextResponse } from 'next/server';
import {
  listAnalystRunsForCompany,
} from '@/lib/server/firestoreService';
import { requireAuth, resolveCompanyContext } from '@/lib/server/apiAuth';

export async function GET(req: Request) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const activeCompanyId = await resolveCompanyContext(user!.id, user!.activeCompanyId);

  if (!activeCompanyId) {
    return NextResponse.json([]);
  }

  const history = await listAnalystRunsForCompany(activeCompanyId, 120);
  const points = history.map((item) => ({
    date: item.createdAt.slice(0, 10),
    score: item.score,
    deterministicScore: item.deterministicScore,
    llmDeltaApplied: item.llmDeltaApplied,
    confidenceScore: item.confidenceScore,
    tenderId: item.tenderId,
    tenderTitle: item.tenderTitle,
    trigger: item.trigger,
    reasonCodes: item.reasonCodes,
    source: item.source,
    model: item.model,
    recommendation: item.recommendation,
  }));

  return NextResponse.json(points);
}
