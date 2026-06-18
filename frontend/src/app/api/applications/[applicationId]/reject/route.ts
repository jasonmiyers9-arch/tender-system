import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/apiAuth';
import { reviewApplication } from '@/lib/server/firestoreService';
import { canReviewApplication, reviewerName } from '@/lib/server/providerApplicationAuth';

export async function POST(
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

  const body = await req.json().catch(() => ({})) as { reason?: string };
  const updated = await reviewApplication(applicationId, {
    status: 'rejected',
    reviewedBy: await reviewerName(user!.id),
    rejectionReason: body.reason?.trim() || null,
  });

  return NextResponse.json({ ok: true, application: updated });
}
