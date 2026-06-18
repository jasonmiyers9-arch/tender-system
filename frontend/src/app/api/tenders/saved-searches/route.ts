import { NextResponse } from 'next/server';
import {
  createSavedTenderSearch,
  getUserByToken,
  listSavedTenderSearches,
  type SavedTenderSearchRecord,
} from '@/lib/server/firestoreService';

function tokenFromRequest(request: Request): string | null {
  const [scheme, token] = (request.headers.get('authorization') || '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

async function authenticatedUser(request: Request) {
  const token = tokenFromRequest(request);
  return token ? getUserByToken(token) : null;
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ searches: await listSavedTenderSearches(user.id) });
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as Partial<SavedTenderSearchRecord>;
  const name = String(body.name || '').trim();
  if (!name || name.length > 80 || !body.filters || typeof body.filters !== 'object') {
    return NextResponse.json({ detail: 'A name and valid filters are required' }, { status: 400 });
  }
  const frequency = body.frequency === 'weekly' || body.frequency === 'paused' ? body.frequency : 'daily';
  const search = await createSavedTenderSearch({
    userId: user.id,
    companyId: user.activeCompanyId ?? user.companyId,
    name,
    filters: body.filters,
    frequency,
  });
  return NextResponse.json(search, { status: 201 });
}
