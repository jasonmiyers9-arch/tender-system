import { NextResponse } from 'next/server';
import {
  getUserByToken,
  listCompaniesForUser,
  listAnalystRunsForCompany,
  ensureUserCompanyContext,
} from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json([]);
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json([]);
  }

  let activeCompanyId = user.activeCompanyId;
  if (!activeCompanyId) {
    const companies = await listCompaniesForUser(user.id);
    activeCompanyId = companies[0]?.id ?? null;
  }

  if (!activeCompanyId) {
    const ensured = await ensureUserCompanyContext(user.id);
    activeCompanyId = ensured?.id ?? null;
  }

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
