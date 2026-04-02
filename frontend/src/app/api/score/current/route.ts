import { NextResponse } from 'next/server';
import { getUserByToken, listCompaniesForUser, listDocumentsForCompany } from '@/lib/server/firestoreService';
import { buildComplianceScore } from '@/lib/utils/calculateReadinessScore';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await getUserByToken(token);
    if (!user) {
      // Token unrecognised (e.g. in-memory DB reset in dev). Return an
      // empty-document score rather than a hard error so the UI stays functional.
      return NextResponse.json(buildComplianceScore([]), { status: 200 });
    }

    let activeCompanyId = user.activeCompanyId;
    if (!activeCompanyId) {
      const companies = await listCompaniesForUser(user.id);
      activeCompanyId = companies[0]?.id ?? null;
    }

    if (!activeCompanyId) {
      return NextResponse.json(buildComplianceScore([]), { status: 200 });
    }

    const documents = await listDocumentsForCompany(activeCompanyId);
    return NextResponse.json(buildComplianceScore(documents));
  } catch (error) {
    console.error('GET /api/score/current error:', error);
    return NextResponse.json(buildComplianceScore([]), { status: 200 });
  }
}
