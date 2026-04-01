import { NextResponse } from 'next/server';
import { getApplicationById, submitApplication } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { applicationId } = await params;
  const application = await getApplicationById(applicationId);
  if (!application) {
    return NextResponse.json({ detail: 'Application not found' }, { status: 404 });
  }

  return NextResponse.json(application);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { applicationId } = await params;
  const body = await req.json();
  const action = String(body.action ?? '').trim();

  if (action === 'submit') {
    const updated = await submitApplication(applicationId);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ detail: 'Unknown action' }, { status: 400 });
}
