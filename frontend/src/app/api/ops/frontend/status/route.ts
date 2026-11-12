import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { getFrontendStatus } from '../monitorStore';

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;
  const status = getFrontendStatus(req);
  return NextResponse.json(status);
}
