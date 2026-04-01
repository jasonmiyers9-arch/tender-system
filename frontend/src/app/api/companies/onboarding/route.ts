import { NextResponse } from 'next/server';
import { getUserByToken, updateCompanyProfile, getCompanyById } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function POST(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || !user.activeCompanyId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const allowedFields = {
    csd_number: body.csd_number ?? null,
    bbbee_level: body.bbbee_level ?? null,
    cidb_grade: body.cidb_grade ?? null,
    industry_sector: body.industry_sector ?? null,
    province: body.province ?? null,
  };

  const company = await getCompanyById(user.activeCompanyId);
  if (!company) {
    return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
  }

  const updatedCompany = await updateCompanyProfile(user.activeCompanyId, {
    industry: allowedFields.industry_sector ?? company.industry,
    address: allowedFields.province ? company.address : company.address,
    registrationNumber: company.registrationNumber,
    vatNumber: company.vatNumber,
    email: company.email,
    phone: company.phone,
    website: company.website,
  });

  return NextResponse.json({ ok: true, company: updatedCompany, onboardingCompleted: false });
}
