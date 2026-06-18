import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/server/cronAuth';
import { runExpiryCheck } from '@/lib/server/expiryCheckService';
import { runRecordedJob } from '@/lib/server/scheduledJobRecorder';

export async function POST(req: Request) {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  const result = await runRecordedJob('check_document_expiry', async () => {
    const expiry = await runExpiryCheck(false);
    return {
      ...expiry,
      job: 'check_document_expiry',
      ok: expiry.errors.length === 0,
    };
  });
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
