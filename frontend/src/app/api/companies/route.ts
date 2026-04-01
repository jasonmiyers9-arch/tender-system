import { NextResponse } from 'next/server';
import { getUserByToken, listCompaniesForUser } from '@/lib/server/firestoreService';

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

  const companies = await listCompaniesForUser(user.id);
  return NextResponse.json({ items: companies });
}
