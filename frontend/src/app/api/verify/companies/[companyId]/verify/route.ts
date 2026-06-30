import { NextResponse } from 'next/server';
import {
  createNotification,
  getCompanyById,
  listAllUsers,
  listCompanyMembers,
  updateCompanyProfile,
} from '@/lib/server/firestoreService';
import { isAdminRole, requireRole } from '@/lib/server/apiAuth';
import { extractRequestContext, logSecurityEvent, SecurityEventType } from '@/lib/server/securityAudit';

export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { user, error } = await requireRole(req, ['evaluator', 'admin']);
  if (error) return error;

  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) return NextResponse.json({ detail: 'Company not found' }, { status: 404 });

  const verifiedAt = new Date().toISOString();
  const updated = await updateCompanyProfile(companyId, { status: 'verified' });

  // Notify the company's own members that their entity has been verified.
  const members = await listCompanyMembers(companyId);
  await Promise.all(members.map((member) => createNotification({
    companyId,
    userId: member.id,
    alertType: 'info',
    title: 'Company verified',
    message: `${company.name} was verified by ${user!.fullName}.`,
    triggerDate: verifiedAt,
    dedupeKey: `evaluator-company-verified:${companyId}:${verifiedAt}:member:${member.id}`,
  })));

  // Keep admins in the loop on the verification action.
  const admins = (await listAllUsers()).filter((candidate) => isAdminRole(candidate.role));
  await Promise.all(admins.map((admin) => createNotification({
    companyId,
    userId: admin.id,
    alertType: 'info',
    title: 'Company marked verified',
    message: `${company.name} was verified by evaluator ${user!.fullName}.`,
    triggerDate: verifiedAt,
    dedupeKey: `evaluator-company-verified-admin:${companyId}:${verifiedAt}:admin:${admin.id}`,
  })));

  await logSecurityEvent({
    type: SecurityEventType.DATA_UPDATE,
    userId: user!.id,
    userEmail: user!.email,
    userRole: user!.role,
    companyId,
    outcome: 'success',
    resourceType: 'company_verification',
    resourceId: companyId,
    ...extractRequestContext(req),
    details: { action: 'evaluator_verified_company', companyName: company.name, verifiedAt },
  });

  return NextResponse.json({ ok: true, verifiedAt, status: updated.status });
}
