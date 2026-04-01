import { NextResponse } from 'next/server';
import { getFrontendStatus } from '../monitorStore';

export async function GET(req: Request) {
  const status = getFrontendStatus(req);
  return NextResponse.json(status);
}
