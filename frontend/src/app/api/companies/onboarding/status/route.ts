import { NextResponse } from 'next/server';
import {
  ensureUserCompanyContext,
  getCompanyById,
  getUserByToken,
  getUserOnboardingStatus,
  listCompaniesForUser,
} from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
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

  let companyId = user.activeCompanyId ?? null;
  if (!companyId) {
    const companies = await listCompaniesForUser(user.id);
    companyId = companies[0]?.id ?? null;
  }
  if (!companyId) {
    const ensured = await ensureUserCompanyContext(user.id);
    companyId = ensured?.id ?? null;
  }
  if (!companyId) {
    return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
  }

  const company = await getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
  }

  const priorityDocs = await getUserOnboardingStatus({ ...user, activeCompanyId: companyId, companyId });
  const checks = priorityDocs.checks;
  const doneCount = Object.values(checks).filter(Boolean).length;

  return NextResponse.json({
    onboardingCompleted: priorityDocs.completed,
    companyId: company.id,
    checks,
    documentsUploaded: priorityDocs.documentsUploaded,
    requiredDocuments: priorityDocs.requiredDocuments,
    priorityDocuments: [
      { category: 'bbbee_certificate', label: 'B-BBEE certificate', uploaded: priorityDocs.checks.bbbee_certificate },
      { category: 'sars_pin', label: 'SARS TCS Pin', uploaded: priorityDocs.checks.sars_pin },
      { category: 'cipc_registration', label: 'CIPC registration certificate', uploaded: priorityDocs.checks.cipc_registration },
    ],
    completionPercent: Math.floor((doneCount / Object.keys(checks).length) * 100),
  });
}
