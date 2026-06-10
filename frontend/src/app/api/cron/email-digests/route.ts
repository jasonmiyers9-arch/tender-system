import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/server/cronAuth';
import { runSendEmailDigestsJob } from '@/lib/server/scheduledJobs';

export async function POST(req: Request) {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  const result = await runSendEmailDigestsJob();
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
