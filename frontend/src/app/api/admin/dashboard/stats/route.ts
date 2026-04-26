import { NextResponse } from 'next/server';
import { listAllCompanies, listAllDocuments } from '@/lib/server/firestoreService';
import { requireAdmin } from '@/lib/server/apiAuth';

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const companies = await listAllCompanies();
  const docs = await listAllDocuments();

  let tenderReady = 0;
  let partiallyReady = 0;
  let highRisk = 0;

  for (const company of companies) {
    const companyDocs = docs.filter((doc) => doc.companyId === company.id);
    const hasRisk = companyDocs.some((doc) => doc.status === 'expired' || doc.status === 'rejected');

    if (hasRisk) {
      highRisk += 1;
    } else if (companyDocs.length >= 3) {
      tenderReady += 1;
    } else {
      partiallyReady += 1;
    }
  }

  const pendingVerification = docs.filter((doc) => doc.status === 'uploaded').length;

  return NextResponse.json({
    totalCompanies: companies.length,
    tenderReady,
    partiallyReady,
    highRisk,
    totalDocuments: docs.length,
    pendingVerification,
  });
}
