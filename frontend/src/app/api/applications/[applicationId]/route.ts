import { NextResponse } from 'next/server';
import { getApplicationById, submitApplication } from '@/lib/server/firestoreService';
import { isAdminRole, requireAuth, resolveCompanyContext } from '@/lib/server/apiAuth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const { applicationId } = await params;
  const application = await getApplicationById(applicationId);
  if (!application) {
    return NextResponse.json({ detail: 'Application not found' }, { status: 404 });
  }

  // Ownership check: user must belong to the company that owns the application
  const companyId = await resolveCompanyContext(user!.id, user!.activeCompanyId);
  if (application.companyId && application.companyId !== companyId && !isAdminRole(user!.role)) {
    return NextResponse.json({ detail: 'Application not found' }, { status: 404 });
  }

  return NextResponse.json(application);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { error } = await requireAuth(req);
  if (error) return error;

  const { applicationId } = await params;
  const body = await req.json();
  const action = String(body.action ?? '').trim();

  if (action === 'submit') {
    const updated = await submitApplication(applicationId);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ detail: 'Unknown action' }, { status: 400 });
}
