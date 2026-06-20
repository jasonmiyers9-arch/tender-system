import { NextResponse } from 'next/server';
import {
  getUserByToken,
  listTenders,
  listApplicationsForTenders,
  getCompanyById,
  getUserDocumentById,
} from '@/lib/server/firestoreService';
import { isAdminRole } from '@/lib/server/apiAuth';

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

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ detail: 'Admin only' }, { status: 403 });
  }

  const providerTenders = await listTenders({ createdBy: user.id });
  const tenderById = new Map(providerTenders.map((t) => [t.id, t]));
  const applications = await listApplicationsForTenders(providerTenders.map((t) => t.id));

  const submitted = applications.filter((app) => app.status !== 'draft');

  const enriched = await Promise.all(
    submitted.map(async (app) => {
      const tender = tenderById.get(app.tenderId);
      const company = await getCompanyById(app.companyId);
      const applicant = await getUserDocumentById(app.userId);
      return {
        id: app.id,
        tenderId: app.tenderId,
        tenderTitle: tender?.title ?? 'Unknown Tender',
        tenderOrganization: tender?.organization ?? 'Unknown',
        tenderDeadline: tender?.deadline ?? '',
        tenderValue: tender?.value ?? '',
        providerEmail: user.email,
        companyId: Number(app.companyId) || 0,
        companyName: company?.name ?? 'Unknown Company',
        appliedBy: applicant?.fullName ?? 'Unknown',
        appliedAt: app.submittedAt ?? app.createdAt,
        status: mapStatus(app.status),
        reviewedBy: app.reviewedBy ?? undefined,
        reviewedAt: app.reviewedAt ?? undefined,
        rejectionReason: app.rejectionReason ?? undefined,
      };
    })
  );

  enriched.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());

  return NextResponse.json(enriched);
}
