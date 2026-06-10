import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/server/cronAuth';
import { runExpiryCheck } from '@/lib/server/expiryCheckService';

export async function POST(req: Request) {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  const result = await runExpiryCheck(false);
  return NextResponse.json({
    job: 'daily-expiry-check',
    ok: result.errors.length === 0,
    ...result,
  }, { status: result.errors.length ? 207 : 200 });
}
