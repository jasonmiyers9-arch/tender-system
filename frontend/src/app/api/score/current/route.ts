import { NextResponse } from 'next/server';
import { requireAuth, resolveCompanyContext } from '@/lib/server/apiAuth';
import { listDocumentsForCompany } from '@/lib/server/firestoreService';
import { generateComplianceProfile } from '@/lib/server/complianceScoring';

export async function GET(req: Request) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const companyId = await resolveCompanyContext(user!.id, user!.activeCompanyId);
  if (!companyId) {
    return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
  }

  const documents = await listDocumentsForCompany(companyId);
  const profile = generateComplianceProfile(companyId, documents);

  const band =
    profile.overallScore >= 80 ? 'ready' :
    profile.overallScore >= 50 ? 'partially-ready' :
    'not-ready';

  return NextResponse.json({
    score: profile.overallScore,
    band,
    completedDocuments: profile.documentCount,
    totalDocuments: profile.documentCount + profile.missingCategories.length,
    missingDocuments: profile.missingCategories,
    expiringDocuments: profile.expiringDocuments.map(d => d.documentName),
    lastCalculated: profile.lastCalculated,
  });
}
