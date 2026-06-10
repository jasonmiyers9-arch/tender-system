import { NextResponse } from 'next/server';
import { runAutoRescoreForCompany } from '@/lib/server/analystEngine';
import { verifyCronRequest } from '@/lib/server/cronAuth';
import { listAllCompanies } from '@/lib/server/firestoreService';

export async function POST(req: Request) {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  const companies = await listAllCompanies();
  const errors: string[] = [];
  let rescoredCompanies = 0;

  for (const company of companies) {
    try {
      await runAutoRescoreForCompany({
        companyId: company.id,
        trigger: 'scheduled.score.snapshot',
      });
      rescoredCompanies++;
    } catch (err) {
      errors.push(`Failed to rescore company ${company.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    job: 'daily-score-snapshot',
    ok: errors.length === 0,
    checkedAt: new Date().toISOString(),
    companiesChecked: companies.length,
    rescoredCompanies,
    errors,
  }, { status: errors.length ? 207 : 200 });
}
