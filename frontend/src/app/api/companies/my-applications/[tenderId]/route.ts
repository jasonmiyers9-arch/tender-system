import { NextResponse } from 'next/server';
import {
  getTenderById,
  getUserByToken,
  listApplicationsForCompany,
  listCompaniesForUser,
} from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

function mapStatus(status: string): 'pending' | 'approved' | 'rejected' {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

export async function GET(req: Request, ctx: { params: Promise<{ tenderId: string }> }) {
  const token = parseToken(req);
  if (!token) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const user = await getUserByToken(token);
  if (!user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });

  const companies = await listCompaniesForUser(user.id);
  if (!companies.length) return NextResponse.json(null);

  const { tenderId } = await ctx.params;
  const activeCompany = companies.find((company) => company.id === user.activeCompanyId) ?? companies[0];
  const applications = await listApplicationsForCompany(activeCompany.id);
  const app = applications.find((item) => item.tenderId === tenderId);

  if (!app) return NextResponse.json(null);

  const tender = await getTenderById(app.tenderId);
  return NextResponse.json({
    id: app.id,
    tenderId: app.tenderId,
    tenderTitle: tender?.title ?? 'Unknown Tender',
    tenderOrganization: tender?.organization ?? 'Unknown Organization',
    tenderDeadline: tender?.deadline ?? app.createdAt,
    tenderValue: tender?.value ?? '',
    providerEmail: null,
    companyId: activeCompany.id,
    companyName: activeCompany.name,
    appliedBy: user.fullName || user.email,
    appliedAt: app.submittedAt ?? app.createdAt,
    status: mapStatus(app.status),
    reviewedBy: app.reviewedBy ?? undefined,
    reviewedAt: app.reviewedAt ?? undefined,
    rejectionReason: app.rejectionReason ?? undefined,
  });
}
