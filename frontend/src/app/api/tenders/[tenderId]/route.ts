import { NextResponse } from 'next/server';
import { getTenderById, getUserByToken, updateTender, deleteTender } from '@/lib/server/firestoreService';
import { publishRescoreEvent } from '@/lib/server/analystEngine';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const { tenderId } = await params;
  const tender = await getTenderById(tenderId);
  if (!tender) {
    return NextResponse.json({ detail: 'Tender not found' }, { status: 404 });
  }
  return NextResponse.json(tender, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'evaluator' && user.role !== 'admin') {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
  }

  try {
    const { tenderId } = await params;
    const body = await req.json();
    const updated = await updateTender(tenderId, {
      title: body?.title,
      organization: body?.organization,
      deadline: body?.deadline,
      value: body?.value,
      category: body?.category,
      location: body?.location,
      description: body?.description,
      requirements: Array.isArray(body?.requirements) ? body.requirements : undefined,
      eligibilityCriteria: Array.isArray(body?.eligibilityCriteria) ? body.eligibilityCriteria : undefined,
      required_categories: Array.isArray(body?.required_categories) ? body.required_categories : undefined,
      status: body?.status,
    });

    if (updated.companyId) {
      await publishRescoreEvent({
        eventType: 'tender.updated',
        companyId: updated.companyId,
        actorUserId: user.id,
        tenderId: updated.id,
        metadata: { status: updated.status },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/tenders/[tenderId] error:', error);
    return NextResponse.json({ detail: 'Failed to update tender' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ tenderId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'evaluator' && user.role !== 'admin') {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
  }

  try {
    const { tenderId } = await params;
    await deleteTender(tenderId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/tenders/[tenderId] error:', error);
    return NextResponse.json({ detail: 'Failed to delete tender' }, { status: 500 });
  }
}
