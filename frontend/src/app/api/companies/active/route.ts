import { NextResponse } from 'next/server';
import { getUserByToken, getCompanyById, listCompaniesForUser, ensureUserCompanyContext, updateCompanyProfile } from '@/lib/server/firestoreService';
import { isAdminRole } from '@/lib/server/apiAuth';
import { publishRescoreEvent } from '@/lib/server/analystEngine';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  if (isAdminRole(user.role)) {
    if (!user.activeCompanyId) {
      return NextResponse.json(null);
    }
    const activeCompany = await getCompanyById(user.activeCompanyId);
    return NextResponse.json(activeCompany ?? null);
  }

  const companies = await listCompaniesForUser(user.id);
  if (!companies.length) {
    const ensured = await ensureUserCompanyContext(user.id);
    if (ensured) {
      return NextResponse.json(ensured);
    }
    return NextResponse.json({ detail: 'No companies found' }, { status: 404 });
  }

  const activeCompanyId = user.activeCompanyId ?? companies[0].id;
  let activeCompany = await getCompanyById(activeCompanyId);

  // Recover gracefully if the stored active company id is stale.
  if (!activeCompany) {
    activeCompany = await getCompanyById(companies[0].id);
  }
  if (!activeCompany) {
    return NextResponse.json(null);
  }

  return NextResponse.json(activeCompany);
}

export async function PATCH(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  let companyId: string | null = null;
  if (isAdminRole(user.role)) {
    companyId = user.activeCompanyId ?? null;
  } else {
    const companies = await listCompaniesForUser(user.id);
    companyId = user.activeCompanyId ?? companies[0]?.id ?? null;
    const isMember = companies.some((c) => c.id === companyId);
    if (!isMember) companyId = null;
  }

  if (!companyId) {
    return NextResponse.json({ detail: 'No active company' }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    if (payload.csd_number !== undefined && payload.csdNumber === undefined) {
      payload.csdNumber = payload.csd_number;
    }
    if (payload.bbbee_level !== undefined && payload.bbbeeLevel === undefined) {
      payload.bbbeeLevel = payload.bbbee_level;
    }
    if (payload.cidb_grade !== undefined && payload.cidbGrade === undefined) {
      payload.cidbGrade = payload.cidb_grade;
    }
    delete payload.status;

    const company = await updateCompanyProfile(companyId, payload);
    await publishRescoreEvent({
      eventType: 'company.profile.updated',
      companyId,
      actorUserId: user.id,
      metadata: { updatedFields: Object.keys(payload) },
    });
    return NextResponse.json(company);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to update company' },
      { status: 400 },
    );
  }
}
