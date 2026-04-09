import { NextResponse } from 'next/server';
import { listTenders, createTender, getUserByToken } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mineOnly = url.searchParams.get('mine') === 'true';

  let items;
  if (mineOnly) {
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

    items = await listTenders({ createdBy: user.id, includeSystem: false });
  } else {
    items = await listTenders();
  }

  return NextResponse.json(items, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
    },
  });
}

export async function POST(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await getUserByToken(token);
    if (!user) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'evaluator' && user.role !== 'admin') {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      organization,
      deadline,
      value,
      category,
      location,
      description,
      requirements,
      eligibilityCriteria,
      required_categories,
      status,
    } = body;

    if (!title || !organization || !deadline || !value || !category || !location || !description) {
      return NextResponse.json(
        { detail: 'Missing required fields: title, organization, deadline, value, category, location, description' },
        { status: 400 },
      );
    }

    const tender = await createTender({
      title,
      organization,
      deadline,
      value,
      category,
      location,
      description,
      requirements: Array.isArray(requirements) ? requirements : [],
      eligibilityCriteria: Array.isArray(eligibilityCriteria) ? eligibilityCriteria : [],
      required_categories: Array.isArray(required_categories) ? required_categories : [],
      status: status === 'published' ? 'published' : 'draft',
      createdBy: user.id,
      companyId: user.activeCompanyId ?? undefined,
    });

    return NextResponse.json(tender, { status: 201 });
  } catch (error) {
    console.error('POST /api/tenders error:', error);
    return NextResponse.json({ detail: 'Failed to create tender' }, { status: 500 });
  }
}
