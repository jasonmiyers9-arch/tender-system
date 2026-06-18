import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/server/cronAuth';
import { runCleanupExpiredSessionsJob } from '@/lib/server/scheduledJobs';
import { runRecordedJob } from '@/lib/server/scheduledJobRecorder';

export async function POST(req: Request) {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  const result = await runRecordedJob('cleanup_expired_sessions', runCleanupExpiredSessionsJob);
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
