import { NextResponse } from 'next/server';
import {
  createNotification,
  getCompanyById,
  listAllUsers,
} from '@/lib/server/firestoreService';
import { isAdminRole, requireRole } from '@/lib/server/apiAuth';
import { extractRequestContext, logSecurityEvent, SecurityEventType } from '@/lib/server/securityAudit';

export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { user, error } = await requireRole(req, ['evaluator', 'admin']);
  if (error) return error;

  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) return NextResponse.json({ detail: 'Company not found' }, { status: 404 });

  const flaggedAt = new Date().toISOString();
  const admins = (await listAllUsers()).filter((candidate) => isAdminRole(candidate.role));
  await Promise.all(admins.map((admin) => createNotification({
    companyId,
    userId: admin.id,
    alertType: 'danger',
    title: 'Company flagged for compliance review',
    message: `${company.name} was flagged by evaluator ${user!.fullName}.`,
    triggerDate: flaggedAt,
    dedupeKey: `evaluator-review-flag:${companyId}:${flaggedAt}:admin:${admin.id}`,
  })));

  await logSecurityEvent({
    type: SecurityEventType.DATA_CREATE,
    userId: user!.id,
    userEmail: user!.email,
    userRole: user!.role,
    companyId,
    outcome: 'success',
    resourceType: 'compliance_review_flag',
    resourceId: companyId,
    ...extractRequestContext(req),
    details: { action: 'evaluator_flagged_company_for_review', companyName: company.name, flaggedAt },
  });

  return NextResponse.json({ ok: true, flaggedAt });
}
