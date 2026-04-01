import { NextResponse } from 'next/server';
import { getUserByToken, setActiveCompany } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function POST(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const companyId = String(body.company_id ?? '').trim();
  if (!companyId) {
    return NextResponse.json({ detail: 'company_id is required' }, { status: 400 });
  }

  try {
    const company = await setActiveCompany(user.id, companyId);
    return NextResponse.json({ activeCompanyId: company.id, company });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Unable to switch company' }, { status: 400 });
  }
}
