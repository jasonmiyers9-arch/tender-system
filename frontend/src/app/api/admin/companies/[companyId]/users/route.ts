import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { listCompanyMembers } from '@/lib/server/firestoreService';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { companyId } = await params;
  const members = await listCompanyMembers(companyId);

  const items = members.map((m) => ({
    id: m.id,
    name: m.fullName,
    email: m.email,
    role: m.role,
    verificationStatus: m.verificationStatus,
    createdAt: m.createdAt,
  }));

  return NextResponse.json({ items });
}
