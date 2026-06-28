import { NextResponse } from 'next/server';
import {
  getUserByToken,
  listApplicationsForCompany,
  getCompanyById,
} from '@/lib/server/firestoreService';
import { resolveTender } from '@/lib/server/tenderResolver';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

function mapStatus(status: string): 'pending' | 'submitted' | 'shortlisted' | 'awarded' | 'lost' | 'approved' | 'rejected' {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'submitted') return 'submitted';
  if (status === 'shortlisted') return 'shortlisted';
  if (status === 'awarded') return 'awarded';
  if (status === 'lost') return 'lost';
  return 'pending';
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const { tenderId } = await params;

  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || !user.activeCompanyId) {
    return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
  }

  const applications = await listApplicationsForCompany(user.activeCompanyId);
  const app = applications.find((a) => a.tenderId === tenderId);

  if (!app) {
    return NextResponse.json(null);
  }

  const { tender } = await resolveTender(app.tenderId);
  const company = await getCompanyById(user.activeCompanyId);

  const enrichedApp = {
    id: app.id,
    tenderId: app.tenderId,
    tenderTitle: tender?.title ?? 'Unknown Tender',
    tenderOrganization: tender?.organization ?? 'Unknown',
    tenderDeadline: tender?.deadline ?? '',
    tenderValue: tender?.value ?? '',
    providerEmail: null,
    companyId: Number(app.companyId) || 0,
    companyName: company?.name ?? 'Unknown Company',
    appliedBy: user.fullName,
    appliedAt: app.submittedAt ?? app.createdAt,
    status: mapStatus(app.status),
    reviewedBy: app.reviewedBy ?? undefined,
    reviewedAt: app.reviewedAt ?? undefined,
    rejectionReason: app.rejectionReason ?? undefined,
    outcomeReason: app.outcomeReason ?? undefined,
    awardValue: app.awardValue ?? undefined,
  };

  return NextResponse.json(enrichedApp);
}
