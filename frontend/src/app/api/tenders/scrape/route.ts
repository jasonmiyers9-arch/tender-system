import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/apiAuth';
import {
  runScrapeAll,
  runScrapeSingle,
  getScrapedTenders,
  getScrapedTenderCount,
  getScrapeHistory,
  getScraperConfigs,
  getCustomSources,
  addCustomSource,
  removeCustomSource,
  toggleScraperSource,
  scrapeGenericUrl,
} from '@/lib/server/tenderScraper';
import type { ScrapeOptions } from '@/lib/server/tenderScraper';
import { TENDER_CATEGORIES } from '@/lib/server/tenderCategories';
import { importAndMatchScrapedTenders, importScrapedTenders } from '@/lib/server/scheduledJobs';
import { listScheduledJobRuns } from '@/lib/server/firestoreService';

function getManualScrapeOptions(body: Record<string, unknown>): ScrapeOptions {
  const deep = body.deep === true;
  const maxPages = Number.isFinite(Number(body.maxPages))
    ? Math.min(10, Math.max(1, Number(body.maxPages)))
    : deep
      ? undefined
      : 1;

  return {
    categories: Array.isArray(body.categories) ? body.categories.map(String).filter(Boolean) : undefined,
    maxPages,
    extractPdfs: deep,
    scrapeDetails: deep,
  };
}

// GET /api/tenders/scrape — Get scraper status, history, and scraped tenders
export async function GET(req: Request) {
  const { error } = await requireRole(req, ['admin', 'evaluator']);
  if (error) return error;

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // Return scraped tenders with optional filtering
  if (action === 'tenders') {
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search')?.toLowerCase();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));

    let tenders = getScrapedTenders();

    if (category) {
      tenders = tenders.filter(t => t.category === category);
    }
    if (search) {
      tenders = tenders.filter(t =>
        t.title.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.organization.toLowerCase().includes(search)
      );
    }

    const total = tenders.length;
    const offset = (page - 1) * limit;
    const paginated = tenders.slice(offset, offset + limit);

    return NextResponse.json({
      tenders: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  }

  // Return categories list
  if (action === 'categories') {
    return NextResponse.json({ categories: TENDER_CATEGORIES });
  }

  // Default: return scraper status
  return NextResponse.json({
    sources: getScraperConfigs(),
    customSources: getCustomSources(),
    totalScrapedTenders: getScrapedTenderCount(),
    history: getScrapeHistory().slice(0, 20),
    automationRuns: await listScheduledJobRuns(20),
    categories: TENDER_CATEGORIES,
  });
}

// POST /api/tenders/scrape — Trigger scraping or manage sources
export async function POST(req: Request) {
  const { error } = await requireRole(req, ['admin']);
  if (error) return error;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'scrape-all': {
        const scrapedSince = new Date().toISOString();
        const options = getManualScrapeOptions(body);
        const results = await runScrapeAll(options);
        const hasErrors = results.some((result) => result.errors.length > 0);
        const recommendationResult = await importScrapedTenders({ scrapedSince });
        return NextResponse.json({
          message: 'Scraping completed',
          results,
          totalScrapedTenders: getScrapedTenderCount(),
          importedTenders: recommendationResult.importedTenderIds.length,
          skippedDuplicates: recommendationResult.skippedDuplicates,
          matchResult: null,
        }, { status: hasErrors ? 207 : 200 });
      }

      case 'scrape-source': {
        const sourceName = body.sourceName as string;
        if (!sourceName) {
          return NextResponse.json({ detail: 'sourceName is required' }, { status: 400 });
        }
        const scrapedSince = new Date().toISOString();
        const result = await runScrapeSingle(sourceName, getManualScrapeOptions(body));
        const recommendationResult = await importScrapedTenders({ scrapedSince });
        return NextResponse.json({
          message: `Scraped ${sourceName}`,
          result,
          totalScrapedTenders: getScrapedTenderCount(),
          importedTenders: recommendationResult.importedTenderIds.length,
          skippedDuplicates: recommendationResult.skippedDuplicates,
          matchResult: null,
        }, { status: result.errors.length ? 207 : 200 });
      }

      case 'scrape-url': {
        const url = body.url as string;
        if (!url) {
          return NextResponse.json({ detail: 'url is required' }, { status: 400 });
        }
        // Validate URL format
        try {
          new URL(url);
        } catch {
          return NextResponse.json({ detail: 'Invalid URL format' }, { status: 400 });
        }
        const tenders = await scrapeGenericUrl(url);
        const recommendationResult = await importScrapedTenders();
        return NextResponse.json({
          message: `Scraped ${url}`,
          tenders,
          count: tenders.length,
          importedTenders: recommendationResult.importedTenderIds.length,
          skippedDuplicates: recommendationResult.skippedDuplicates,
          matchResult: null,
        });
      }

      case 'add-source': {
        const sourceUrl = body.url as string;
        const name = body.name as string;
        if (!sourceUrl || !name) {
          return NextResponse.json({ detail: 'url and name are required' }, { status: 400 });
        }
        addCustomSource(sourceUrl, name);
        return NextResponse.json({
          message: `Added source: ${name}`,
          customSources: getCustomSources(),
        });
      }

      case 'remove-source': {
        const sourceUrl = body.url as string;
        if (!sourceUrl) {
          return NextResponse.json({ detail: 'url is required' }, { status: 400 });
        }
        removeCustomSource(sourceUrl);
        return NextResponse.json({
          message: 'Source removed',
          customSources: getCustomSources(),
        });
      }

      case 'toggle-source': {
        const name = body.name as string;
        const enabled = body.enabled as boolean;
        if (!name || typeof enabled !== 'boolean') {
          return NextResponse.json({ detail: 'name and enabled (boolean) are required' }, { status: 400 });
        }
        toggleScraperSource(name, enabled);
        return NextResponse.json({
          message: `${name} ${enabled ? 'enabled' : 'disabled'}`,
          sources: getScraperConfigs(),
          customSources: getCustomSources(),
        });
      }

      case 'import-to-system': {
        const recommendationResult = await importAndMatchScrapedTenders();
        const matchErrors = recommendationResult.matchResult.errors ?? [];

        return NextResponse.json({
          message: `${recommendationResult.importedTenderIds.length} tenders imported and matched to companies`,
          importedTenders: recommendationResult.importedTenderIds.length,
          importedTenderIds: recommendationResult.importedTenderIds,
          skippedDuplicates: recommendationResult.skippedDuplicates,
          matchResult: recommendationResult.matchResult,
        }, { status: matchErrors.length ? 207 : 200 });
      }

      default:
        return NextResponse.json({ detail: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('POST /api/tenders/scrape error:', err);
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Scraping failed' },
      { status: 500 },
    );
  }
}
