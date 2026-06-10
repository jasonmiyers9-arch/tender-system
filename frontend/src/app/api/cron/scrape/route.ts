import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/server/cronAuth';
import { getScrapedTenderCount, runScrapeAll } from '@/lib/server/tenderScraper';

export async function POST(req: Request) {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  const results = await runScrapeAll({ extractPdfs: true, scrapeDetails: true });
  const errors = results.flatMap((result) => result.errors.map((error) => `${result.source}: ${error}`));

  return NextResponse.json({
    job: 'six-hourly-tender-scrape',
    ok: errors.length === 0,
    checkedAt: new Date().toISOString(),
    results,
    totalScrapedTenders: getScrapedTenderCount(),
    errors,
  }, { status: errors.length ? 207 : 200 });
}
