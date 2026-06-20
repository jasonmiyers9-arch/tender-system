import { NextResponse } from 'next/server';
import {
  createNotificationsForCompany,
  ensureUserCompanyContext,
  getCompanyById,
  getUserByToken,
  getUserOnboardingStatus,
  listDocumentsForCompany,
  listCompaniesForUser,
  updateCompanyProfile,
} from '@/lib/server/firestoreService';
import { publishRescoreEvent } from '@/lib/server/analystEngine';
import { buildComplianceScore } from '@/lib/utils/calculateReadinessScore';

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

  const body = await req.json();
  const allowedFields = {
    csd_number: String(body.csd_number ?? '').trim() || null,
    bbbee_level: String(body.bbbee_level ?? '').trim() || null,
    cidb_grade: String(body.cidb_grade ?? '').trim() || null,
    industry_sector: String(body.industry_sector ?? '').trim() || null,
    province: String(body.province ?? '').trim() || null,
  };

  const company = await getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
  }

  const updatedCompany = await updateCompanyProfile(companyId, {
    industry: allowedFields.industry_sector ?? company.industry,
    province: allowedFields.province ?? company.province ?? null,
    csdNumber: allowedFields.csd_number ?? company.csdNumber ?? null,
    bbbeeLevel: allowedFields.bbbee_level ?? company.bbbeeLevel ?? null,
    cidbGrade: allowedFields.cidb_grade ?? company.cidbGrade ?? null,
    registrationNumber: company.registrationNumber,
    vatNumber: company.vatNumber,
    address: company.address,
    email: company.email,
    phone: company.phone,
    website: company.website,
  });
  const documents = await listDocumentsForCompany(companyId);
  const complianceScore = buildComplianceScore(documents);
  const priorityDocs = await getUserOnboardingStatus({ ...user, activeCompanyId: companyId, companyId });
  const profileComplete = Boolean(
    updatedCompany.csdNumber &&
    updatedCompany.bbbeeLevel &&
    updatedCompany.industry &&
    updatedCompany.province
  );
  const onboardingCompleted = profileComplete && priorityDocs.completed;

  await publishRescoreEvent({
    eventType: 'company.updated',
    companyId,
    actorUserId: user.id,
    metadata: {
      updatedFields: Object.keys(allowedFields).filter((key) => allowedFields[key as keyof typeof allowedFields] !== null),
      documentsUploaded: priorityDocs.documentsUploaded,
      requiredDocuments: priorityDocs.requiredDocuments,
      onboardingCompleted,
    },
  });

  await createNotificationsForCompany(companyId, {
    alertType: 'info',
    title: 'Company profile created',
    message: `Your company profile has been created. Current compliance score: ${complianceScore.score}% (${complianceScore.band}). You will receive future emails only when a tender matches your company.`,
    triggerDate: new Date().toISOString(),
    dedupeKey: `company-profile-created:${companyId}`,
  });

  return NextResponse.json({ ok: true, company: updatedCompany, onboardingCompleted });
}
