import { NextResponse } from 'next/server';
import { getTenderReadiness, getUserByToken } from '@/lib/server/firestoreService';
import { requireAuth, parseBearerToken } from '@/lib/server/apiAuth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const { error } = await requireAuth(req);
  if (error) return error;

  const { tenderId } = await params;
  
  // Get company context from authenticated user
  const token = parseBearerToken(req);
  let companyId: string | undefined;
  
  if (token) {
    const user = await getUserByToken(token);
    if (user?.activeCompanyId) {
      companyId = user.activeCompanyId;
    }
  }
  
  const readiness = await getTenderReadiness(tenderId, companyId);
  if (!readiness) {
    return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
  }
  return NextResponse.json(readiness, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
    },
  });
}
