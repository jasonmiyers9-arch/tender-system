// ─────────────────────────────────────────────
// Tender Scraper Service
// Scrapes SA government tender websites and stores results
// ─────────────────────────────────────────────

import * as cheerio from 'cheerio';
import { normalizeTenderCategory } from './tenderCategories';

// ─── Types ────────────────────────────────────

export interface ScrapedTender {
  title: string;
  organization: string;
  category: string;
  description: string;
  deadline: string;
  advertised: string;
  value: string;
  location: string;
  referenceNumber: string;
  sourceUrl: string;
  sourceSite: string;
  rawCategory: string;
  requirements: string[];
  eligibilityCriteria: string[];
  scrapedAt: string;
}

export interface ScrapeResult {
  source: string;
  totalScraped: number;
  newTenders: number;
  duplicatesSkipped: number;
  errors: string[];
  scrapedAt: string;
}

export interface ScraperConfig {
  name: string;
  enabled: boolean;
  baseUrl: string;
  scrapeFunction: (config: ScraperConfig) => Promise<ScrapedTender[]>;
}

// ─── Scrape History (in-memory for now) ───────

const scrapeHistory: ScrapeResult[] = [];
const scrapedTenderCache: Map<string, ScrapedTender> = new Map();

export function getScrapeHistory(): ScrapeResult[] {
  return [...scrapeHistory].reverse();
}

export function getScrapedTenders(): ScrapedTender[] {
  return Array.from(scrapedTenderCache.values());
}

export function getScrapedTenderCount(): number {
  return scrapedTenderCache.size;
}

// ─── Utility Helpers ──────────────────────────

function generateTenderKey(tender: ScrapedTender): string {
  const normalized = `${tender.title.toLowerCase().trim()}|${tender.organization.toLowerCase().trim()}|${tender.deadline}`;
  return normalized;
}

function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.trim();

  // Handle dd/MM/yyyy format common in SA
  const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Handle dd-MM-yyyy
  const dashMatch = cleaned.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dashMatch) {
    const [, day, month, year] = dashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Handle yyyy-MM-dd (already ISO)
  const isoMatch = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return cleaned;

  // Handle "14/04/2026" or "in X days" pattern from eTenders
  const inDaysMatch = cleaned.match(/in\s+(\d+)\s+days?/i);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const target = new Date();
    target.setDate(target.getDate() + days);
    return target.toISOString().split('T')[0];
  }

  return cleaned;
}

async function fetchPage(url: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TenderGuard-Bot/1.0 (+https://tenderguard.co.za)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-ZA,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.text();
    } catch (err) {
      if (attempt === retries) {
        throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts: ${err instanceof Error ? err.message : String(err)}`);
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

// ─── eTenders.gov.za Scraper ──────────────────

async function scrapeETenders(config: ScraperConfig): Promise<ScrapedTender[]> {
  const tenders: ScrapedTender[] = [];
  const maxPages = 10; // Scrape first 10 pages (100 tenders)

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `${config.baseUrl}/Home/opportunities?id=1&page=${page}`;
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // eTenders uses a table layout for tender listings
      const rows = $('tr').toArray();

      for (const row of rows) {
        try {
          const cells = $(row).find('td');
          if (cells.length < 4) continue;

          const rawCategory = $(cells[0]).text().trim();
          const description = $(cells[1]).text().trim();
          const advertised = $(cells[2]).text().trim();
          const closingRaw = $(cells[3]).text().trim();

          if (!description || !rawCategory) continue;

          // Extract reference number if present (usually in the expanded detail)
          const refMatch = description.match(/([A-Z]{2,}[\/-]\d{4}[\/-]\d+[A-Z]?)/i);
          const referenceNumber = refMatch ? refMatch[1] : '';

          const tender: ScrapedTender = {
            title: description.substring(0, 200),
            organization: 'South African Government',
            category: normalizeTenderCategory(rawCategory),
            rawCategory,
            description,
            deadline: parseDate(closingRaw),
            advertised: parseDate(advertised),
            value: 'Contact for details',
            location: 'South Africa',
            referenceNumber,
            sourceUrl: url,
            sourceSite: 'etenders.gov.za',
            requirements: [],
            eligibilityCriteria: [],
            scrapedAt: new Date().toISOString(),
          };

          tenders.push(tender);
        } catch {
          // Skip malformed rows
        }
      }

      // Check if there's a next page
      const hasNext = $('a:contains("Next")').length > 0;
      if (!hasNext) break;

      // Be respectful - wait between pages
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(`eTenders page ${page} scrape error:`, err);
      break;
    }
  }

  return tenders;
}

// ─── TenderBulletins.co.za Scraper ────────────

async function scrapeTenderBulletins(config: ScraperConfig): Promise<ScrapedTender[]> {
  const tenders: ScrapedTender[] = [];
  const maxPages = 5;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1
        ? `${config.baseUrl}/tenders/`
        : `${config.baseUrl}/tenders/page/${page}/`;

      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // TenderBulletins typically uses article/post format
      const articles = $('article, .tender-item, .post, .entry').toArray();

      for (const article of articles) {
        try {
          const titleEl = $(article).find('h2 a, h3 a, .entry-title a, .tender-title a').first();
          const title = titleEl.text().trim();
          const detailUrl = titleEl.attr('href') || '';

          if (!title) continue;

          const excerptEl = $(article).find('.entry-content, .excerpt, .tender-description, p').first();
          const excerpt = excerptEl.text().trim();

          // Try to extract category from breadcrumbs or tags
          const categoryEl = $(article).find('.category, .cat-links a, .tender-category, .tag').first();
          const rawCategory = categoryEl.text().trim() || 'General';

          // Extract dates from text
          const fullText = $(article).text();
          const closingDateMatch = fullText.match(/clos(?:ing|e)\s*(?:date)?[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i);
          const deadline = closingDateMatch ? parseDate(closingDateMatch[1]) : '';

          // Extract organization/department
          const orgMatch = fullText.match(/(?:department|dept|municipality|entity|province)\s*(?:of|:)?\s*([^\n,]+)/i);
          const organization = orgMatch ? orgMatch[1].trim().substring(0, 100) : 'South African Government';

          // Extract reference number
          const refMatch = fullText.match(/(?:ref|reference|bid|tender)\s*(?:no|number)?[:\s]*([A-Z0-9\/-]+)/i);
          const referenceNumber = refMatch ? refMatch[1].trim() : '';

          const tender: ScrapedTender = {
            title: title.substring(0, 200),
            organization,
            category: normalizeTenderCategory(rawCategory),
            rawCategory,
            description: excerpt || title,
            deadline,
            advertised: new Date().toISOString().split('T')[0],
            value: 'Contact for details',
            location: 'South Africa',
            referenceNumber,
            sourceUrl: detailUrl || url,
            sourceSite: 'tenderbulletins.co.za',
            requirements: [],
            eligibilityCriteria: [],
            scrapedAt: new Date().toISOString(),
          };

          tenders.push(tender);
        } catch {
          // Skip malformed entries
        }
      }

      const hasNext = $('a.next, .nav-next a, a:contains("Next")').length > 0;
      if (!hasNext) break;

      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(`TenderBulletins page ${page} scrape error:`, err);
      break;
    }
  }

  return tenders;
}

// ─── General Purpose Link Scraper ─────────────

/**
 * Scrape tenders from any URL with configurable selectors.
 * This is the flexible option for manually added sources.
 */
export async function scrapeGenericUrl(url: string): Promise<ScrapedTender[]> {
  const tenders: ScrapedTender[] = [];

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    // Try common patterns for listing pages
    const selectors = [
      'table tr',
      'article',
      '.tender-item',
      '.listing-item',
      '.post',
      '.entry',
      'li.tender',
      '.card',
    ];

    for (const selector of selectors) {
      const elements = $(selector).toArray();
      if (elements.length < 2) continue;

      for (const el of elements) {
        const text = $(el).text().trim();
        if (text.length < 20) continue;

        const linkEl = $(el).find('a').first();
        const title = linkEl.text().trim() || text.substring(0, 150);
        const href = linkEl.attr('href') || '';

        // Try to find dates
        const dateMatch = text.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/);
        const deadline = dateMatch ? parseDate(dateMatch[1]) : '';

        // Try to find reference numbers
        const refMatch = text.match(/([A-Z]{2,}[\/-]\d{3,}[\/-]?\d*)/i);

        if (title && title.length > 10) {
          tenders.push({
            title: title.substring(0, 200),
            organization: new URL(url).hostname,
            category: 'Other',
            rawCategory: '',
            description: text.substring(0, 500),
            deadline,
            advertised: new Date().toISOString().split('T')[0],
            value: 'Contact for details',
            location: 'South Africa',
            referenceNumber: refMatch ? refMatch[1] : '',
            sourceUrl: href.startsWith('http') ? href : new URL(href, url).toString(),
            sourceSite: new URL(url).hostname,
            requirements: [],
            eligibilityCriteria: [],
            scrapedAt: new Date().toISOString(),
          });
        }
      }

      if (tenders.length > 0) break; // Found results with this selector
    }
  } catch (err) {
    console.error(`Generic scrape error for ${url}:`, err);
  }

  return tenders;
}

// ─── Scraper Registry ─────────────────────────

const scraperConfigs: ScraperConfig[] = [
  {
    name: 'eTenders.gov.za',
    enabled: true,
    baseUrl: 'https://www.etenders.gov.za',
    scrapeFunction: scrapeETenders,
  },
  {
    name: 'TenderBulletins.co.za',
    enabled: true,
    baseUrl: 'https://tenderbulletins.co.za',
    scrapeFunction: scrapeTenderBulletins,
  },
];

// Custom URLs added by admin
const customSources: { url: string; name: string; enabled: boolean }[] = [];

export function getScraperConfigs() {
  return scraperConfigs.map(s => ({ name: s.name, enabled: s.enabled, baseUrl: s.baseUrl }));
}

export function getCustomSources() {
  return [...customSources];
}

export function addCustomSource(url: string, name: string) {
  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }
  if (customSources.find(s => s.url === url)) {
    throw new Error('Source already exists');
  }
  customSources.push({ url, name, enabled: true });
}

export function removeCustomSource(url: string) {
  const idx = customSources.findIndex(s => s.url === url);
  if (idx === -1) throw new Error('Source not found');
  customSources.splice(idx, 1);
}

export function toggleScraperSource(name: string, enabled: boolean) {
  const config = scraperConfigs.find(s => s.name === name);
  if (config) {
    config.enabled = enabled;
    return;
  }
  const custom = customSources.find(s => s.name === name);
  if (custom) {
    custom.enabled = enabled;
    return;
  }
  throw new Error(`Source "${name}" not found`);
}

// ─── Main Scrape Orchestrator ─────────────────

export async function runScrapeAll(): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  // Run built-in scrapers
  for (const config of scraperConfigs) {
    if (!config.enabled) continue;

    const result: ScrapeResult = {
      source: config.name,
      totalScraped: 0,
      newTenders: 0,
      duplicatesSkipped: 0,
      errors: [],
      scrapedAt: new Date().toISOString(),
    };

    try {
      const tenders = await config.scrapeFunction(config);
      result.totalScraped = tenders.length;

      for (const tender of tenders) {
        const key = generateTenderKey(tender);
        if (scrapedTenderCache.has(key)) {
          result.duplicatesSkipped++;
        } else {
          scrapedTenderCache.set(key, tender);
          result.newTenders++;
        }
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    results.push(result);
  }

  // Run custom URL scrapers
  for (const source of customSources) {
    if (!source.enabled) continue;

    const result: ScrapeResult = {
      source: source.name,
      totalScraped: 0,
      newTenders: 0,
      duplicatesSkipped: 0,
      errors: [],
      scrapedAt: new Date().toISOString(),
    };

    try {
      const tenders = await scrapeGenericUrl(source.url);
      result.totalScraped = tenders.length;

      for (const tender of tenders) {
        const key = generateTenderKey(tender);
        if (scrapedTenderCache.has(key)) {
          result.duplicatesSkipped++;
        } else {
          scrapedTenderCache.set(key, tender);
          result.newTenders++;
        }
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    results.push(result);
  }

  scrapeHistory.push(...results);
  return results;
}

/**
 * Scrape a single source by name
 */
export async function runScrapeSingle(sourceName: string): Promise<ScrapeResult> {
  const config = scraperConfigs.find(s => s.name === sourceName);

  const result: ScrapeResult = {
    source: sourceName,
    totalScraped: 0,
    newTenders: 0,
    duplicatesSkipped: 0,
    errors: [],
    scrapedAt: new Date().toISOString(),
  };

  try {
    let tenders: ScrapedTender[];

    if (config) {
      tenders = await config.scrapeFunction(config);
    } else {
      const custom = customSources.find(s => s.name === sourceName);
      if (!custom) throw new Error(`Source "${sourceName}" not found`);
      tenders = await scrapeGenericUrl(custom.url);
    }

    result.totalScraped = tenders.length;

    for (const tender of tenders) {
      const key = generateTenderKey(tender);
      if (scrapedTenderCache.has(key)) {
        result.duplicatesSkipped++;
      } else {
        scrapedTenderCache.set(key, tender);
        result.newTenders++;
      }
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  scrapeHistory.push(result);
  return result;
}
