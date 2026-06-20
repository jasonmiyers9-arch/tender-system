import { NextResponse } from 'next/server';
import { isFirestoreAvailable } from './firebaseAdmin';

export function verifyCronRequest(req: Request): NextResponse | null {
  if (process.env.NODE_ENV === 'production' && !isFirestoreAvailable()) {
    return NextResponse.json({ detail: 'Firebase persistence unavailable' }, { status: 503 });
  }
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ detail: 'CRON_SECRET is not configured' }, { status: 500 });
    }
    return null;
  }

  const provided = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
