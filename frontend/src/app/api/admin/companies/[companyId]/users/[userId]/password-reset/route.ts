import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { listCompanyMembers } from '@/lib/server/firestoreService';
import { generatePasswordResetLink } from '@/lib/server/firebaseAdmin';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string; userId: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { companyId, userId } = await params;
  const members = await listCompanyMembers(companyId);
  const target = members.find((m) => m.id === userId);

  if (!target) {
    return NextResponse.json(
      { detail: 'User is not a member of this company' },
      { status: 404 },
    );
  }

  if (!target.email) {
    return NextResponse.json(
      { detail: 'User has no email on file' },
      { status: 400 },
    );
  }

  try {
    const resetLink = await generatePasswordResetLink(target.email);
    return NextResponse.json({
      email: target.email,
      resetLink,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate password reset link';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
