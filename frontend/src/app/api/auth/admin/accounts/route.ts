import { NextResponse } from 'next/server';
import { createUser, getCompanyById, getUserByToken, listCompaniesForUser, listUsers } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : null;
}

async function requireAdmin(req: Request) {
  const token = parseToken(req);
  if (!token) return { error: NextResponse.json({ detail: 'Unauthorized' }, { status: 401 }) };

  const user = await getUserByToken(token);
  if (!user) return { error: NextResponse.json({ detail: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ detail: 'Forbidden' }, { status: 403 }) };

  return { user };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const status =
    statusParam === 'pending' || statusParam === 'approved' || statusParam === 'rejected'
      ? statusParam
      : undefined;

  const users = await listUsers({ status });
  users.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const now = Date.now();
  const items = await Promise.all(
    users.map(async (u) => {
      let companyName = '—';
      if (u.companyId) {
        const company = await getCompanyById(u.companyId);
        if (company?.name) companyName = company.name;
      } else {
        const companies = await listCompaniesForUser(u.id);
        if (companies[0]?.name) companyName = companies[0].name;
      }

      const createdMs = Date.parse(u.createdAt);
      const pendingHours = Number.isFinite(createdMs) ? Math.max(0, Math.floor((now - createdMs) / (1000 * 60 * 60))) : 0;

      return {
        id: u.id,
        name: u.fullName || u.email.split('@')[0],
        email: u.email,
        role: u.role,
        verificationStatus: u.verificationStatus,
        createdAt: u.createdAt,
        companyName,
        pendingHours,
        slaBreached: u.verificationStatus === 'pending' ? pendingHours > 48 : false,
      };
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!name || !email || !password) {
    return NextResponse.json({ detail: 'Name, email and password are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ detail: 'Password must be at least 8 characters' }, { status: 400 });
  }

  try {
    const user = await createUser({
      name,
      email,
      password,
      role: 'admin',
      verificationStatus: 'approved',
    });

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Failed to create admin account' }, { status: 400 });
  }
}
