import { NextResponse } from 'next/server';
import { listTenders, createTender, getUserByToken, getTenderReadiness } from '@/lib/server/firestoreService';
import { publishRescoreEvent } from '@/lib/server/analystEngine';
import type { TenderMatch } from '@/lib/api/types';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mineOnly = url.searchParams.get('mine') === 'true';
  const token = parseToken(req);
  
  // Get user for company context
  let companyId: string | undefined;
  if (token) {
    const user = await getUserByToken(token);
    if (user?.activeCompanyId) {
      companyId = user.activeCompanyId;
    }
    
    // Handle mine-only filter for evaluators
    if (mineOnly) {
      if (!user) {
        return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
      }
      if (user.role !== 'evaluator' && user.role !== 'admin') {
        return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
      }
      const items = await listTenders({ createdBy: user.id, includeSystem: false });
      return NextResponse.json(items, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
        },
      });
    }
  }

  const items = await listTenders();
  
  // If company context available, enrich with readiness scores
  if (companyId) {
    const enrichedItems: TenderMatch[] = await Promise.all(
      items.map(async (tender) => {
        const readiness = await getTenderReadiness(tender.id, companyId);
        if (readiness) {
          return {
            ...tender,
            matchScore: readiness.readinessScore, // Use new readiness score
            readinessScore: readiness.readinessScore,
            scoreBreakdown: readiness.scoreBreakdown,
            isBidReady: readiness.isBidReady,
            gaps: readiness.gaps,
          };
        }
        return tender;
      })
    );
    
    return NextResponse.json(enrichedItems, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
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

    if (tender.companyId) {
      await publishRescoreEvent({
        eventType: 'tender.created',
        companyId: tender.companyId,
        actorUserId: user.id,
        tenderId: tender.id,
        metadata: { status: tender.status },
      });
    }

    return NextResponse.json(tender, { status: 201 });
  } catch (error) {
    console.error('POST /api/tenders error:', error);
    return NextResponse.json({ detail: 'Failed to create tender' }, { status: 500 });
  }
}
