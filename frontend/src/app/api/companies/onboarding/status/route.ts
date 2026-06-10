import { NextResponse } from 'next/server';
import { getUserByToken, getCompanyById, getUserOnboardingStatus } from '@/lib/server/firestoreService';

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
  if (!user || !user.activeCompanyId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const company = await getCompanyById(user.activeCompanyId);
  if (!company) {
    return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
  }

  const profileChecks = {
    csd_number: Boolean(company.csdNumber),
    bbbee_level: Boolean(company.bbbeeLevel),
    industry_sector: Boolean(company.industry),
    province: Boolean(company.province),
  };
  const priorityDocs = await getUserOnboardingStatus(user);
  const checks = {
    ...profileChecks,
    bbbee_certificate: priorityDocs.checks.bbbee_certificate,
    sars_pin: priorityDocs.checks.sars_pin,
    cipc_registration: priorityDocs.checks.cipc_registration,
  };
  const completed = Object.values(checks).every(Boolean);
  const doneCount = Object.values(checks).filter(Boolean).length;

  return NextResponse.json({
    onboardingCompleted: completed,
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
