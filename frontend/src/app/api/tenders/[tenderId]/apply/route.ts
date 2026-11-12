import { NextResponse } from 'next/server';
import { requireAuth, resolveCompanyContext } from '@/lib/server/apiAuth';
import {
  createApplication,
  listApplicationsForCompany,
  submitApplication,
} from '@/lib/server/firestoreService';
import { resolveTender } from '@/lib/server/tenderResolver';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> },
) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const { tenderId } = await params;
  const companyId = await resolveCompanyContext(user!.id, user!.activeCompanyId);
  if (!companyId) {
    return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
  }

  const { tender } = await resolveTender(tenderId);
  if (!tender) {
    return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
  }
  if (tender.status && tender.status !== 'published') {
    return NextResponse.json({ detail: 'This tender is not open for applications' }, { status: 400 });
  }

  const existing = await listApplicationsForCompany(companyId);
  const prior = existing.find((application) => application.tenderId === tenderId);
  const application = prior ?? await createApplication({
    tenderId,
    companyId,
    userId: user!.id,
  });
  const submitted = application.status === 'draft' || !application.submittedAt
    ? await submitApplication(application.id)
    : application;

  return NextResponse.json({
    ok: true,
    application: {
      id: submitted.id,
      tenderId: submitted.tenderId,
      tenderTitle: tender.title,
      tenderOrganization: tender.organization,
      tenderDeadline: tender.deadline,
      tenderValue: tender.value,
      providerEmail: null,
      companyId,
      companyName: null,
      appliedBy: user!.fullName,
      appliedAt: submitted.submittedAt ?? submitted.createdAt,
      status: submitted.status === 'submitted' ? 'submitted' : submitted.status,
    },
  });
}
