import { NextResponse } from 'next/server';
import { listCompaniesForUser, setActiveCompany } from '@/lib/server/firestoreService';
import { isAdminRole, requireAuth } from '@/lib/server/apiAuth';

export async function POST(req: Request) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const body = await req.json();
  const companyId = String(body.company_id ?? '').trim();
  if (!companyId) {
    return NextResponse.json({ detail: 'company_id is required' }, { status: 400 });
  }

  // Ownership check: user can only switch to companies they belong to
  const userCompanies = await listCompaniesForUser(user!.id);
  const allowed = userCompanies.some(c => c.id === companyId) || isAdminRole(user!.role);
  if (!allowed) {
    return NextResponse.json({ detail: 'Forbidden: not a member of this company' }, { status: 403 });
  }

  try {
    const company = await setActiveCompany(user!.id, companyId);
    return NextResponse.json({ activeCompanyId: company.id, company });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Unable to switch company' }, { status: 400 });
  }
}
