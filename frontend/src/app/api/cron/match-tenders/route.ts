import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/server/cronAuth';
import { runMatchTendersToCompaniesJob } from '@/lib/server/scheduledJobs';

export async function POST(req: Request) {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({})) as { tenderIds?: string[] };
  const result = await runMatchTendersToCompaniesJob(body.tenderIds);
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
