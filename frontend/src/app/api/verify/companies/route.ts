import { NextResponse } from 'next/server';
import { getUserByToken, listAllCompanies, listDocumentsForCompany } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

function toBand(score: number): 'tender-ready' | 'partially-ready' | 'high-risk' {
  if (score >= 85) return 'tender-ready';
  if (score >= 65) return 'partially-ready';
  return 'high-risk';
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function GET(req: Request) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || (user.role !== 'admin' && user.role !== 'evaluator')) {
    return NextResponse.json({ detail: 'Evaluator or admin only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = normalize(url.searchParams.get('q') ?? '');

  const companies = await listAllCompanies();
  const filtered = !q
    ? companies
    : companies.filter((company) => {
        const hayName = normalize(company.name);
        const hayReg = normalize(company.registrationNumber ?? '');
        return hayName.includes(q) || hayReg.includes(q);
      });

  const items = await Promise.all(
    filtered.map(async (company) => {
      const docs = await listDocumentsForCompany(company.id);
      const verifiedCount = docs.filter((doc) => doc.status === 'verified').length;
      const score = docs.length === 0 ? 0 : Math.round((verifiedCount / docs.length) * 100);
      const lastUpdated = docs
        .map((doc) => doc.verifiedAt ?? doc.uploadedAt)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? new Date().toISOString();

      return {
        id: company.id,
        name: company.name,
        registrationNumber: company.registrationNumber,
        score,
        band: toBand(score),
        lastUpdated,
      };
    })
  );

  items.sort((a, b) => b.score - a.score);
  return NextResponse.json(items);
}
