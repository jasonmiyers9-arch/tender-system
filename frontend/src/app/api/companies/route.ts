import { NextResponse } from 'next/server';
import { getUserByToken, listAllCompanies, listCompaniesForUser } from '@/lib/server/firestoreService';
import { isAdminRole } from '@/lib/server/apiAuth';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ items: [] });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ items: [] });
  }

  const companies =
    isAdminRole(user.role)
      ? await listAllCompanies()
      : await listCompaniesForUser(user.id);
  return NextResponse.json({ items: companies });
}
