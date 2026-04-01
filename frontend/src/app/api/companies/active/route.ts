import { NextResponse } from 'next/server';
import { getUserByToken, getCompanyById, listCompaniesForUser } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const companies = await listCompaniesForUser(user.id);
  if (!companies.length) {
    return NextResponse.json({ detail: 'No companies found' }, { status: 404 });
  }

  const activeCompanyId = user.activeCompanyId ?? companies[0].id;
  const activeCompany = await getCompanyById(activeCompanyId);
  if (!activeCompany) {
    return NextResponse.json({ detail: 'Active company not found' }, { status: 404 });
  }

  return NextResponse.json(activeCompany);
}
