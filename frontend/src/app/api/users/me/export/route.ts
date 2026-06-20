import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/apiAuth';
import {
  listApplicationsForCompany,
  listCompaniesForUser,
  listDocumentsForCompany,
  listNotificationsForUser,
} from '@/lib/server/firestoreService';
import { queryAuditLogs } from '@/lib/server/securityAudit';

export async function GET(req: Request) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const companies = await listCompaniesForUser(user!.id);
  const companyData = await Promise.all(companies.map(async (company) => ({
    company,
    documents: await listDocumentsForCompany(company.id),
    applications: await listApplicationsForCompany(company.id),
  })));
  const [notifications, auditEvents] = await Promise.all([
    listNotificationsForUser(user!.id, false, 1000),
    queryAuditLogs({ userId: user!.id, limit: 1000 }),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    user: {
      id: user!.id,
      email: user!.email,
      fullName: user!.fullName,
      phone: user!.phone ?? null,
      role: user!.role,
      createdAt: user!.createdAt,
      privacyAcceptedAt: user!.privacyAcceptedAt ?? null,
    },
    companies: companyData,
    notifications,
    auditEvents,
  }, { headers: { 'Content-Disposition': 'attachment; filename="tenderguard-data-export.json"', 'Cache-Control': 'no-store' } });
}
