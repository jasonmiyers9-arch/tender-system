import { NextResponse } from 'next/server';
import { getUserByToken, updateUserVerificationStatus } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const token = parseToken(req);
  if (!token) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const actor = await getUserByToken(token);
  if (!actor) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  if (actor.role !== 'admin') return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });

  const { userId } = await ctx.params;

  try {
    await updateUserVerificationStatus(userId, 'rejected');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Failed to reject account' }, { status: 400 });
  }
}
