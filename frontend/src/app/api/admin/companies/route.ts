import { NextResponse } from 'next/server';
import { listAllCompanies } from '@/lib/server/firestoreService';
import { requireAdmin } from '@/lib/server/apiAuth';

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const items = await listAllCompanies();
  return NextResponse.json({ items });
}