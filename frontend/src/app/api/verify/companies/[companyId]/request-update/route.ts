import { NextResponse } from 'next/server';
import {
  createNotificationsForCompany,
  getCompanyById,
} from '@/lib/server/firestoreService';
import { requireRole } from '@/lib/server/apiAuth';
import { extractRequestContext, logSecurityEvent, SecurityEventType } from '@/lib/server/securityAudit';

export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { user, error } = await requireRole(req, ['evaluator', 'admin']);
  if (error) return error;

  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) return NextResponse.json({ detail: 'Company not found' }, { status: 404 });

  const requestedAt = new Date().toISOString();
  await createNotificationsForCompany(companyId, {
    alertType: 'warning',
    title: 'Compliance update requested',
    message: `${user!.fullName} requested updated compliance documents for evaluator verification.`,
    triggerDate: requestedAt,
    dedupeKey: `evaluator-update-request:${companyId}:${requestedAt}`,
  });

  await logSecurityEvent({
    type: SecurityEventType.DATA_CREATE,
    userId: user!.id,
    userEmail: user!.email,
    userRole: user!.role,
    companyId,
    outcome: 'success',
    resourceType: 'verification_request',
    resourceId: companyId,
    ...extractRequestContext(req),
    details: { action: 'evaluator_requested_bidder_update', companyName: company.name, requestedAt },
  });

  return NextResponse.json({ ok: true, requestedAt });
}
