import { NextResponse } from 'next/server';
import { deleteSavedTenderSearch, getUserByToken } from '@/lib/server/firestoreService';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const [scheme, token] = (request.headers.get('authorization') || '').split(' ');
  const user = scheme?.toLowerCase() === 'bearer' && token ? await getUserByToken(token) : null;
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const { searchId } = await params;
  const deleted = await deleteSavedTenderSearch(searchId, user.id);
  if (!deleted) return NextResponse.json({ detail: 'Saved search not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
