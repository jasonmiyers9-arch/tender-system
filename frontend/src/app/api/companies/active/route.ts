import { NextResponse } from 'next/server';
import { getUserByToken, getCompanyById, listCompaniesForUser, ensureUserCompanyContext } from '@/lib/server/firestoreService';

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
    const ensured = await ensureUserCompanyContext(user.id);
    if (ensured) {
      return NextResponse.json(ensured);
    }
    return NextResponse.json({ detail: 'No companies found' }, { status: 404 });
  }

  const activeCompanyId = user.activeCompanyId ?? companies[0].id;
  let activeCompany = await getCompanyById(activeCompanyId);

  // Recover gracefully if the stored active company id is stale.
  if (!activeCompany) {
    activeCompany = await getCompanyById(companies[0].id);
  }
  if (!activeCompany) {
    return NextResponse.json(null);
  }

  return NextResponse.json(activeCompany);
}
