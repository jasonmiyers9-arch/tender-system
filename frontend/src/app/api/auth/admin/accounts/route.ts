import { NextResponse } from 'next/server';
import { listAllCompanies, listAllUsers } from '@/lib/server/firestoreService';
import { requireAdmin } from '@/lib/server/apiAuth';

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const statusParam = new URL(req.url).searchParams.get('status');
  const companies = await listAllCompanies();
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  const now = Date.now();
  const items = (await listAllUsers())
    .filter((u) => u.role !== 'admin')
    .filter((u) => (statusParam ? u.verificationStatus === statusParam : true))
    .map((u) => {
      const createdAtMs = new Date(u.createdAt).getTime();
      const pendingHours = u.verificationStatus === 'pending' ? Math.max(0, Math.floor((now - createdAtMs) / (1000 * 60 * 60))) : 0;

      return {
        id: u.id,
        name: u.fullName || u.email.split('@')[0],
        email: u.email,
        role: u.role,
        verificationStatus: u.verificationStatus,
        createdAt: u.createdAt,
        companyName: (u.companyId && companyMap.get(u.companyId)) || '—',
        pendingHours,
        slaBreached: pendingHours > 48,
      };
    });

  return NextResponse.json({ items });
}
