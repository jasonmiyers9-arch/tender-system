import { NextResponse } from 'next/server';
import { getUserByToken, getCompanyById } from '@/lib/server/firestoreService';

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
    csd_number: Boolean(company.registrationNumber),
    bbbee_level: Boolean(company.vatNumber),
    industry_sector: Boolean(company.industry),
    province: Boolean(company.address),
  };
  const documentsUploaded = 0;
  const docsOk = documentsUploaded >= 3;
  const completed = Object.values(profileChecks).every(Boolean) && docsOk;
  const checks = {
    ...profileChecks,
    minimum_documents_uploaded: docsOk,
  };
  const doneCount = Object.values(checks).filter(Boolean).length;

  return NextResponse.json({
    onboardingCompleted: completed,
    companyId: company.id,
    checks,
    documentsUploaded,
    requiredDocuments: 3,
    completionPercent: Math.floor((doneCount / Object.keys(checks).length) * 100),
  });
}
