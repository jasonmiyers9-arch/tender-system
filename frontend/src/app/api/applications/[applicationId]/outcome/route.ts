import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/apiAuth';
import { recordApplicationOutcome } from '@/lib/server/firestoreService';
import { canReviewApplication, reviewerName } from '@/lib/server/providerApplicationAuth';

const OUTCOMES = new Set(['shortlisted', 'awarded', 'lost', 'rejected']);

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

  const body = await req.json().catch(() => ({})) as {
    status?: string;
    reason?: string;
    awardValue?: string;
  };
  const status = String(body.status ?? '').trim();
  if (!OUTCOMES.has(status)) {
    return NextResponse.json({ detail: 'Invalid outcome status' }, { status: 400 });
  }

  const application = await recordApplicationOutcome(applicationId, {
    status: status as 'shortlisted' | 'awarded' | 'lost' | 'rejected',
    reviewedBy: await reviewerName(user!.id),
    outcomeReason: body.reason?.trim() || null,
    awardValue: body.awardValue?.trim() || null,
  });

  return NextResponse.json({ ok: true, application });
}
