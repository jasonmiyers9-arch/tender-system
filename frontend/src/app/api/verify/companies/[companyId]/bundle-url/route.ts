import { NextResponse } from 'next/server';
import { getUserByToken } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || (user.role !== 'admin' && user.role !== 'evaluator')) {
    return NextResponse.json({ detail: 'Evaluator or admin only' }, { status: 403 });
  }

  const { companyId } = await params;
  return NextResponse.json({ url: `/api/verify/companies/${companyId}/report` });
}
