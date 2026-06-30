import { NextResponse } from 'next/server';
import { listAllCompanies } from '@/lib/server/firestoreService';
import { requireRole } from '@/lib/server/apiAuth';
import { queryAuditLogs } from '@/lib/server/securityAudit';

export async function GET(req: Request) {
  const { user, error } = await requireRole(req, ['evaluator']);
  if (error) return error;

  let events: Awaited<ReturnType<typeof queryAuditLogs>>;
  let companies: Awaited<ReturnType<typeof listAllCompanies>>;
  try {
    [events, companies] = await Promise.all([
      queryAuditLogs({ userId: user!.id, limit: 100 }),
      listAllCompanies(),
    ]);
  } catch (activityError) {
    console.error('[VerifyActivity] Failed to load evaluator activity', activityError);
    return NextResponse.json([]);
  }

  const companyNames = new Map(companies.map((company) => [company.id, company.name]));

  return NextResponse.json(events
    .filter((event) => {
      const action = String(event.details?.action ?? '');
      return action.startsWith('evaluator_');
    })
    .map((event, index) => ({
      id: event.id ?? `${event.timestamp}-${index}`,
      action: String(event.details?.action ?? event.type).replace(/^evaluator_/, '').replaceAll('_', ' '),
      companyId: event.companyId ?? null,
      companyName: event.companyId ? companyNames.get(event.companyId) ?? null : null,
      timestamp: event.timestamp,
      outcome: event.outcome,
    })));
}
