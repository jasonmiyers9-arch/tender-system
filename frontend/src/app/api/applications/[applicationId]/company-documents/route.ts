import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/apiAuth';
import {
  getCompanyById,
  getUserDocumentById,
  listDocumentsForCompany,
} from '@/lib/server/firestoreService';
import { canReviewApplication } from '@/lib/server/providerApplicationAuth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const { applicationId } = await params;
  const auth = await canReviewApplication(applicationId, user!.id, user!.role);
  if (!auth.ok) {
    return NextResponse.json({ detail: auth.detail }, { status: auth.status });
  }

  const [company, applicant, documents] = await Promise.all([
    getCompanyById(auth.application.companyId),
    getUserDocumentById(auth.application.userId),
    listDocumentsForCompany(auth.application.companyId),
  ]);

  return NextResponse.json({
    companyId: auth.application.companyId,
    companyName: company?.name ?? 'Unknown Company',
    appliedBy: applicant?.fullName ?? 'Unknown',
    documents: documents.map((document) => ({
      id: document.id,
      name: document.name,
      category: document.category,
      status: document.status,
      expiryDate: document.expiryDate,
      uploadedAt: document.uploadedAt,
    })),
  });
}
