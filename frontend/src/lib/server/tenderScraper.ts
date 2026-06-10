// ─────────────────────────────────────────────
// Tender Scraper Service v2
// Scrapes SA government tender websites with full detail pages + PDF extraction
// ─────────────────────────────────────────────

import * as cheerio from 'cheerio';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeTenderCategory } from './tenderCategories';
import { extractPDFContent } from './pdfExtractor';

// ─── Types ────────────────────────────────────

export interface TenderContact {
  contactPerson: string;
  email: string;
  telephone: string;
  fax: string;
}

export interface TenderBriefing {
  hasBriefingSession: boolean;
  isCompulsory: boolean;
  date: string;
  venue: string;
}

export interface TenderDocument {
  filename: string;
  url: string;
  dateUploaded: string;
  extractedText: string;
  extractionStatus: 'pending' | 'success' | 'failed' | 'skipped';
  pageCount: number;
}

export interface ScrapedTender {
  // Core fields
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

  // Detail fields from expanded view
  tenderNumber: string;
  organOfState: string;
  tenderType: string;
  province: string;
  datePublished: string;
  closingDate: string;
  closingTime: string;
  deliveryLocation: string;
  specialConditions: string;

  // Contact info
  contact: TenderContact;

  // Briefing session
  briefing: TenderBriefing;

  // Attached documents with extracted PDF text
  documents: TenderDocument[];

  // Combined full text for AI matching (scraped text + all PDF extracts)
  fullText: string;

  // Whether detail page was successfully scraped
  detailScraped: boolean;
}

export interface ScrapeResult {
  source: string;
  totalScraped: number;
  newTenders: number;
  duplicatesSkipped: number;
  pdfExtracted: number;
  pdfFailed: number;
  errors: string[];
  scrapedAt: string;
  categoriesScraped: string[];
}

export interface ScraperConfig {
  name: string;
  enabled: boolean;
  baseUrl: string;
  scrapeFunction: (config: ScraperConfig, options?: ScrapeOptions) => Promise<ScrapedTender[]>;
}

export interface ScrapeOptions {
  categories?: string[];       // Filter scrape by these categories
  maxPages?: number;           // Limit pages to scrape
  extractPdfs?: boolean;       // Whether to download and extract PDFs (default true)
  scrapeDetails?: boolean;     // Whether to scrape detail pages (default true)
}

// ─── Scrape History and Local Cache ───────────

const scrapeHistory: ScrapeResult[] = [];
const scrapedTenderCache: Map<string, ScrapedTender> = new Map();
const scrapedTenderStoragePath = path.join(process.cwd(), 'storage', 'scraped-tenders.json');

function hydrateScrapedTenderCache(): void {
  if (!existsSync(scrapedTenderStoragePath)) return;

  try {
    const raw = readFileSync(scrapedTenderStoragePath, 'utf8');
    const tenders = JSON.parse(raw) as ScrapedTender[];
    if (!Array.isArray(tenders)) return;

    for (const tender of tenders) {
      if (!tender.category || tender.category === 'Other') {
        tender.category = categorizeTender(tender.rawCategory, tender.title, tender.description, tender.fullText);
      }
      scrapedTenderCache.set(generateTenderKey(tender), tender);
    }
  } catch (error) {
    console.warn('Failed to hydrate scraped tender cache:', error);
  }
}

function persistScrapedTenderCache(): void {
  try {
    mkdirSync(path.dirname(scrapedTenderStoragePath), { recursive: true });
    writeFileSync(
      scrapedTenderStoragePath,
      JSON.stringify(Array.from(scrapedTenderCache.values()), null, 2),
      'utf8',
    );
  } catch (error) {
    console.warn('Failed to persist scraped tender cache:', error);
  }
}

function addScrapedTenderToCache(tender: ScrapedTender): boolean {
  if (!tender.category || tender.category === 'Other') {
    tender.category = categorizeTender(tender.rawCategory, tender.title, tender.description, tender.fullText);
  }

  const key = generateTenderKey(tender);
  const existing = scrapedTenderCache.get(key);
  if (existing) {
    if (existing.category !== tender.category || existing.fullText !== tender.fullText) {
      scrapedTenderCache.set(key, { ...existing, ...tender });
      return true;
    }
    return false;
  }

  scrapedTenderCache.set(key, tender);
  return true;
}

export function getScrapeHistory(): ScrapeResult[] {
  return [...scrapeHistory].reverse();
}

export function getScrapedTenders(): ScrapedTender[] {
  hydrateScrapedTenderCache();
  return Array.from(scrapedTenderCache.values());
}

export function getScrapedTendersByCategory(category: string): ScrapedTender[] {
  hydrateScrapedTenderCache();
  return Array.from(scrapedTenderCache.values()).filter(t => t.category === category);
}

export function getScrapedTendersForCompanyCategories(categories: string[]): ScrapedTender[] {
  hydrateScrapedTenderCache();
  if (!categories.length) return getScrapedTenders();
  const set = new Set(categories);
  return Array.from(scrapedTenderCache.values()).filter(t => set.has(t.category));
}

export function getScrapedTenderCount(): number {
  hydrateScrapedTenderCache();
  return scrapedTenderCache.size;
}

// ─── Utility Helpers ──────────────────────────

function generateTenderKey(tender: ScrapedTender): string {
  return `${tender.tenderNumber || tender.title.toLowerCase().trim()}|${tender.organization.toLowerCase().trim()}|${tender.deadline}`;
}

function categorizeTender(rawCategory: string, ...textParts: string[]): string {
  const fromCategory = normalizeTenderCategory(rawCategory);
  if (fromCategory !== 'Other') return fromCategory;

  const combinedText = textParts.filter(Boolean).join(' ');
  const fromText = normalizeTenderCategory(combinedText);
  return fromText !== 'Other' ? fromText : fromCategory;
}

function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.trim();

  // Handle "Monday, 20 April 2026 - 12:00" format
  const longDateMatch = cleaned.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (longDateMatch) {
    const day = longDateMatch[1];
    const monthName = longDateMatch[2];
    const year = longDateMatch[3];
    const months: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12',
    };
    const month = months[monthName.toLowerCase()];
    if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
  }

  // Handle dd/MM/yyyy
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
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(cleaned)) return cleaned;

  // Handle "in X days"
  const inDaysMatch = cleaned.match(/in\s+(\d+)\s+days?/i);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const target = new Date();
    target.setDate(target.getDate() + days);
    return target.toISOString().split('T')[0];
  }

  return cleaned;
}

function extractClosingTime(dateStr: string): string {
  const timeMatch = dateStr.match(/(\d{1,2}:\d{2})/);
  return timeMatch ? timeMatch[1] : '';
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
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) {
        throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts: ${err instanceof Error ? err.message : String(err)}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

async function fetchPdfBuffer(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TenderGuard-Bot/1.0 (+https://tenderguard.co.za)',
        'Accept': 'application/pdf,*/*',
      },
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream') && !url.toLowerCase().endsWith('.pdf')) {
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > 50 * 1024 * 1024) return null; // 50MB limit

    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error(`PDF download failed for ${url}:`, err);
    return null;
  }
}

function buildFullText(tender: ScrapedTender): string {
  const parts: string[] = [
    `TENDER: ${tender.title}`,
    `TENDER NUMBER: ${tender.tenderNumber}`,
    `ORGAN OF STATE: ${tender.organOfState || tender.organization}`,
    `CATEGORY: ${tender.category} (${tender.rawCategory})`,
    `TENDER TYPE: ${tender.tenderType}`,
    `PROVINCE: ${tender.province}`,
    `LOCATION: ${tender.location}`,
    `DELIVERY LOCATION: ${tender.deliveryLocation}`,
    `DATE PUBLISHED: ${tender.datePublished}`,
    `CLOSING DATE: ${tender.closingDate} ${tender.closingTime}`,
    `SPECIAL CONDITIONS: ${tender.specialConditions}`,
    `DESCRIPTION: ${tender.description}`,
    '',
    `CONTACT: ${tender.contact.contactPerson}`,
    `EMAIL: ${tender.contact.email}`,
    `TELEPHONE: ${tender.contact.telephone}`,
    '',
  ];

  if (tender.briefing.hasBriefingSession) {
    parts.push(`BRIEFING SESSION: ${tender.briefing.date} at ${tender.briefing.venue}`);
    parts.push(`COMPULSORY: ${tender.briefing.isCompulsory ? 'Yes' : 'No'}`);
    parts.push('');
  }

  if (tender.requirements.length > 0) {
    parts.push('REQUIREMENTS:');
    tender.requirements.forEach(r => parts.push(`- ${r}`));
    parts.push('');
  }

  if (tender.eligibilityCriteria.length > 0) {
    parts.push('ELIGIBILITY CRITERIA:');
    tender.eligibilityCriteria.forEach(c => parts.push(`- ${c}`));
    parts.push('');
  }

  for (const doc of tender.documents) {
    if (doc.extractedText) {
      parts.push(`─── ATTACHED DOCUMENT: ${doc.filename} (${doc.pageCount} pages) ───`);
      parts.push(doc.extractedText);
      parts.push('');
    }
  }

  return parts.filter(p => p !== undefined).join('\n');
}

function createEmptyScrapedTender(): ScrapedTender {
  return {
    title: '',
    organization: '',
    category: '',
    description: '',
    deadline: '',
    advertised: '',
    value: 'Contact for details',
    location: 'South Africa',
    referenceNumber: '',
    sourceUrl: '',
    sourceSite: '',
    rawCategory: '',
    requirements: [],
    eligibilityCriteria: [],
    scrapedAt: new Date().toISOString(),
    tenderNumber: '',
    organOfState: '',
    tenderType: '',
    province: '',
    datePublished: '',
    closingDate: '',
    closingTime: '',
    deliveryLocation: '',
    specialConditions: '',
    contact: { contactPerson: '', email: '', telephone: '', fax: '' },
    briefing: { hasBriefingSession: false, isCompulsory: false, date: '', venue: '' },
    documents: [],
    fullText: '',
    detailScraped: false,
  };
}

// ─── eTenders.gov.za Scraper (Enhanced) ───────

/**
 * Parse the expanded detail row from an eTenders listing.
 * The [+] button on eTenders reveals a hidden row with:
 * Tender Number, Organ Of State, Province, Closing Date, Contact Person,
 * Briefing Session, Special Conditions, and attached PDF documents.
 */
function parseETenderDetailRow(
  $: cheerio.CheerioAPI,
  detailRow: Parameters<cheerio.CheerioAPI>[0],
  tender: ScrapedTender,
  baseUrl: string,
): void {
  const text = $(detailRow).text();

  const extractField = (label: string): string => {
    const regex = new RegExp(`${label}[:\\s]*([^\\n]+)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim().replace(/\s+/g, ' ') : '';
  };

  tender.tenderNumber = extractField('Tender Number') || extractField('Bid Number') || extractField('RFQ Number');
  tender.organOfState = extractField('Organ Of State') || extractField('Department') || extractField('Institution');
  tender.tenderType = extractField('Tender Type') || extractField('Bid Type');
  tender.province = extractField('Province');
  tender.datePublished = extractField('Date Published');
  tender.deliveryLocation = extractField('Place where goods');
  tender.specialConditions = extractField('Special Conditions');

  const closingField = extractField('Closing Date');
  if (closingField) {
    tender.closingDate = closingField;
    tender.closingTime = extractClosingTime(closingField);
    tender.deadline = parseDate(closingField);
  }

  tender.contact.contactPerson = extractField('Contact Person');
  tender.contact.email = extractField('Email');
  tender.contact.telephone = extractField('Telephone number') || extractField('Telephone');
  tender.contact.fax = extractField('FAX Number') || extractField('Fax');

  const briefingField = extractField('Is there a briefing session');
  tender.briefing.hasBriefingSession = /yes/i.test(briefingField);
  const compulsoryField = extractField('Is it compulsory');
  tender.briefing.isCompulsory = /yes/i.test(compulsoryField);
  tender.briefing.date = extractField('Briefing Date and Time') || extractField('Briefing Date');
  tender.briefing.venue = extractField('Briefing Venue');

  if (tender.organOfState) tender.organization = tender.organOfState;
  if (tender.tenderNumber) tender.referenceNumber = tender.tenderNumber;

  // Extract PDF links from the detail row
  $(detailRow).find('a[href]').each((_i, link) => {
    const href = $(link).attr('href') || '';
    const linkText = $(link).text().trim();
    if (
      href.toLowerCase().endsWith('.pdf') ||
      linkText.toLowerCase().endsWith('.pdf') ||
      href.toLowerCase().includes('download') ||
      href.toLowerCase().includes('document')
    ) {
      const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
      if (tender.documents.find(d => d.url === fullUrl)) return;
      const dateUploadedMatch = text.match(/Date Uploaded[:\s]*([\d-]+)/i);
      tender.documents.push({
        filename: linkText || href.split('/').pop() || 'document.pdf',
        url: fullUrl,
        dateUploaded: dateUploadedMatch ? dateUploadedMatch[1] : '',
        extractedText: '',
        extractionStatus: 'pending',
        pageCount: 0,
      });
    }
  });

  tender.detailScraped = true;
}

async function scrapeETenders(config: ScraperConfig, options?: ScrapeOptions): Promise<ScrapedTender[]> {
  const tenders: ScrapedTender[] = [];
  const maxPages = options?.maxPages ?? 10;
  const shouldExtractPdfs = options?.extractPdfs !== false;
  const targetCategories = options?.categories ? new Set(options.categories) : null;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `${config.baseUrl}/Home/opportunities?id=1&page=${page}`;
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      const allRows = $('tr').toArray();

      for (let i = 0; i < allRows.length; i++) {
        try {
          const row = allRows[i];
          const cells = $(row).find('td');
          if (cells.length < 4) continue;

          const rawCategory = $(cells[0]).text().trim();
          const description = $(cells[1]).text().trim();
          const advertised = $(cells[2]).text().trim();
          const closingRaw = $(cells[3]).text().trim();

          if (!description || !rawCategory) continue;

          const normalizedCategory = categorizeTender(rawCategory, description);

          // Skip tenders not in the company's categories
          if (targetCategories && !targetCategories.has(normalizedCategory)) {
            continue;
          }

          const tender = createEmptyScrapedTender();
          tender.title = description.substring(0, 300);
          tender.description = description;
          tender.rawCategory = rawCategory;
          tender.category = normalizedCategory;
          tender.advertised = parseDate(advertised);
          tender.deadline = parseDate(closingRaw);
          tender.sourceUrl = url;
          tender.sourceSite = 'etenders.gov.za';

          // Look for the detail/expanded row that follows
          const nextRow = allRows[i + 1];
          if (nextRow) {
            const nextText = $(nextRow).text();
            const nextCells = $(nextRow).find('td');
            if (
              nextCells.length <= 2 ||
              nextText.includes('Tender Number') ||
              nextText.includes('Organ Of State') ||
              nextText.includes('Contact Person') ||
              nextText.includes('Closing Date')
            ) {
              parseETenderDetailRow($, nextRow, tender, config.baseUrl);
              i++; // Skip the detail row
            }
          }

          tender.fullText = buildFullText(tender);
          tenders.push(tender);
        } catch {
          // Skip malformed rows
        }
      }

      const hasNext = $('a:contains("Next")').length > 0;
      if (!hasNext) break;

      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(`eTenders page ${page} scrape error:`, err);
      if (page === 1 && tenders.length === 0) {
        throw err;
      }
      break;
    }
  }

  if (tenders.length === 0) {
    throw new Error('No tenders were parsed from eTenders.gov.za. The source may be unavailable or its listing markup has changed.');
  }

  // Extract PDFs for all collected tenders
  if (shouldExtractPdfs && tenders.length > 0) {
    await extractPdfsForTenders(tenders);
  }

  return tenders;
}

// ─── PDF Extraction for Scraped Tenders ───────

async function extractPdfsForTenders(tenders: ScrapedTender[]): Promise<{ extracted: number; failed: number }> {
  let extracted = 0;
  let failed = 0;

  for (const tender of tenders) {
    for (const doc of tender.documents) {
      if (doc.extractionStatus !== 'pending') continue;

      try {
        console.log(`[Scraper] Downloading PDF: ${doc.filename} from ${doc.url}`);
        const pdfBuffer = await fetchPdfBuffer(doc.url);

        if (!pdfBuffer) {
          doc.extractionStatus = 'skipped';
          continue;
        }

        const result = await extractPDFContent(pdfBuffer);
        doc.extractedText = result.text;
        doc.pageCount = result.pageCount;
        doc.extractionStatus = 'success';
        extracted++;

        console.log(`[Scraper] Extracted ${result.pageCount} pages from ${doc.filename} (${result.text.length} chars)`);
      } catch (err) {
        console.error(`[Scraper] PDF extraction failed for ${doc.filename}:`, err);
        doc.extractionStatus = 'failed';
        failed++;
      }

      // Rate limit PDF downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Rebuild full text with PDF content included
    tender.fullText = buildFullText(tender);
  }

  return { extracted, failed };
}

// ─── TenderBulletins.co.za Scraper ────────────

async function scrapeTenderBulletins(config: ScraperConfig, options?: ScrapeOptions): Promise<ScrapedTender[]> {
  const tenders: ScrapedTender[] = [];
  const maxPages = options?.maxPages ?? 5;
  const shouldExtractPdfs = options?.extractPdfs !== false;
  const targetCategories = options?.categories ? new Set(options.categories) : null;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1
        ? `${config.baseUrl}/tenders/`
        : `${config.baseUrl}/tenders/page/${page}/`;

      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      const articles = $('article, .tender-item, .post, .entry').toArray();

      for (const article of articles) {
        try {
          const titleEl = $(article).find('h2 a, h3 a, .entry-title a, .tender-title a').first();
          const title = titleEl.text().trim();
          const detailUrl = titleEl.attr('href') || '';

          if (!title) continue;

          const excerptEl = $(article).find('.entry-content, .excerpt, .tender-description, p').first();
          const excerpt = excerptEl.text().trim();

          const categoryEl = $(article).find('.category, .cat-links a, .tender-category, .tag').first();
          const rawCategory = categoryEl.text().trim() || 'General';
          const fullText = $(article).text();
          const normalizedCategory = categorizeTender(rawCategory, title, excerpt, fullText);

          if (targetCategories && !targetCategories.has(normalizedCategory)) {
            continue;
          }

          const closingDateMatch = fullText.match(/clos(?:ing|e)\s*(?:date)?[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i);
          const orgMatch = fullText.match(/(?:department|dept|municipality|entity|province|organ)\s*(?:of\s*state)?[:\s]*([^\n,]+)/i);
          const refMatch = fullText.match(/(?:ref|reference|bid|tender)\s*(?:no|number)?[:\s]*([A-Z0-9\/-]+)/i);

          const tender = createEmptyScrapedTender();
          tender.title = title.substring(0, 300);
          tender.description = excerpt || title;
          tender.rawCategory = rawCategory;
          tender.category = normalizedCategory;
          tender.deadline = closingDateMatch ? parseDate(closingDateMatch[1]) : '';
          tender.advertised = new Date().toISOString().split('T')[0];
          tender.organization = orgMatch ? orgMatch[1].trim().substring(0, 100) : 'South African Government';
          tender.referenceNumber = refMatch ? refMatch[1].trim() : '';
          tender.sourceUrl = detailUrl || url;
          tender.sourceSite = 'tenderbulletins.co.za';

          // Scrape the detail page for full info + PDF links
          if (detailUrl && options?.scrapeDetails !== false) {
            try {
              const detailHtml = await fetchPage(detailUrl);
              const $d = cheerio.load(detailHtml);
              const detailText = $d('.entry-content, .tender-detail, article, .post-content').first().text();

              const extract = (label: string) => {
                const re = new RegExp(`${label}[:\\s]*([^\\n]+)`, 'i');
                const m = detailText.match(re);
                return m ? m[1].trim() : '';
              };

              tender.tenderNumber = extract('Tender Number') || extract('Bid Number') || tender.referenceNumber;
              tender.organOfState = extract('Organ of State') || extract('Department');
              tender.tenderType = extract('Tender Type') || extract('Bid Type');
              tender.province = extract('Province');
              tender.datePublished = extract('Date Published');
              tender.deliveryLocation = extract('Place where goods');
              tender.specialConditions = extract('Special Conditions');
              tender.contact.contactPerson = extract('Contact Person');
              tender.contact.email = extract('Email');
              tender.contact.telephone = extract('Telephone');

              const briefingField = extract('briefing session');
              tender.briefing.hasBriefingSession = /yes/i.test(briefingField);

              if (tender.organOfState) tender.organization = tender.organOfState;

              // Find PDF links on detail page
              $d('a[href$=".pdf"], a[href*="download"]').each((_i, link) => {
                const href = $d(link).attr('href') || '';
                const linkText = $d(link).text().trim();
                if (href) {
                  const fullUrl = href.startsWith('http') ? href : new URL(href, detailUrl).toString();
                  if (!tender.documents.find(d => d.url === fullUrl)) {
                    tender.documents.push({
                      filename: linkText || href.split('/').pop() || 'document.pdf',
                      url: fullUrl,
                      dateUploaded: '',
                      extractedText: '',
                      extractionStatus: 'pending',
                      pageCount: 0,
                    });
                  }
                }
              });

              tender.detailScraped = true;
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch {
              // Detail page failed, continue with listing data
            }
          }

          tender.fullText = buildFullText(tender);
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
      if (page === 1 && tenders.length === 0) {
        throw err;
      }
      break;
    }
  }

  if (shouldExtractPdfs && tenders.length > 0) {
    await extractPdfsForTenders(tenders);
  }

  return tenders;
}

// ─── General Purpose Link Scraper ─────────────

export async function scrapeGenericUrl(url: string): Promise<ScrapedTender[]> {
  const tenders: ScrapedTender[] = [];

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const selectors = ['table tr', 'article', '.tender-item', '.listing-item', '.post', '.entry', 'li.tender', '.card'];

    for (const selector of selectors) {
      const elements = $(selector).toArray();
      if (elements.length < 2) continue;

      for (const el of elements) {
        const text = $(el).text().trim();
        if (text.length < 20) continue;

        const linkEl = $(el).find('a').first();
        const title = linkEl.text().trim() || text.substring(0, 150);
        const href = linkEl.attr('href') || '';

        const dateMatch = text.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/);
        const refMatch = text.match(/([A-Z]{2,}[\/-]\d{3,}[\/-]?\d*)/i);

        if (title && title.length > 10) {
          const tender = createEmptyScrapedTender();
          tender.title = title.substring(0, 300);
          tender.description = text.substring(0, 500);
          tender.rawCategory = 'Generic';
          tender.category = categorizeTender(tender.rawCategory, title, text);
          tender.deadline = dateMatch ? parseDate(dateMatch[1]) : '';
          tender.referenceNumber = refMatch ? refMatch[1] : '';
          tender.organization = new URL(url).hostname;
          tender.sourceUrl = href.startsWith('http') ? href : new URL(href, url).toString();
          tender.sourceSite = new URL(url).hostname;
          tender.fullText = buildFullText(tender);
          tenders.push(tender);
        }
      }

      if (tenders.length > 0) break;
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

const customSources: { url: string; name: string; enabled: boolean }[] = [];

function normalizeSourceName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findScraperConfig(sourceName: string): ScraperConfig | undefined {
  const requested = normalizeSourceName(sourceName);
  return scraperConfigs.find((source) => {
    const canonical = normalizeSourceName(source.name);
    return canonical === requested || canonical.startsWith(requested) || requested.startsWith(canonical);
  });
}

function findCustomSource(sourceName: string): { url: string; name: string; enabled: boolean } | undefined {
  const requested = normalizeSourceName(sourceName);
  return customSources.find((source) => normalizeSourceName(source.name) === requested);
}

export function getScraperConfigs() {
  return scraperConfigs.map(s => ({ name: s.name, enabled: s.enabled, baseUrl: s.baseUrl }));
}

export function getCustomSources() {
  return [...customSources];
}

export function addCustomSource(url: string, name: string) {
  try { new URL(url); } catch { throw new Error('Invalid URL format'); }
  if (customSources.find(s => s.url === url)) throw new Error('Source already exists');
  customSources.push({ url, name, enabled: true });
}

export function removeCustomSource(url: string) {
  const idx = customSources.findIndex(s => s.url === url);
  if (idx === -1) throw new Error('Source not found');
  customSources.splice(idx, 1);
}

export function toggleScraperSource(name: string, enabled: boolean) {
  const config = findScraperConfig(name);
  if (config) { config.enabled = enabled; return; }
  const custom = findCustomSource(name);
  if (custom) { custom.enabled = enabled; return; }
  throw new Error(`Source "${name}" not found`);
}

// ─── Main Scrape Orchestrator ─────────────────

/**
 * Scrape all enabled sources. Optionally filter by company tender categories.
 */
export async function runScrapeAll(options?: ScrapeOptions): Promise<ScrapeResult[]> {
  hydrateScrapedTenderCache();
  const results: ScrapeResult[] = [];
  let changed = false;

  for (const config of scraperConfigs) {
    if (!config.enabled) continue;

    const result: ScrapeResult = {
      source: config.name,
      totalScraped: 0,
      newTenders: 0,
      duplicatesSkipped: 0,
      pdfExtracted: 0,
      pdfFailed: 0,
      errors: [],
      scrapedAt: new Date().toISOString(),
      categoriesScraped: options?.categories ?? [],
    };

    try {
      const tenders = await config.scrapeFunction(config, options);
      result.totalScraped = tenders.length;

      for (const tender of tenders) {
        const key = generateTenderKey(tender);
        if (scrapedTenderCache.has(key)) {
          result.duplicatesSkipped++;
          if (addScrapedTenderToCache(tender)) changed = true;
        } else {
          addScrapedTenderToCache(tender);
          result.newTenders++;
          changed = true;
        }
        for (const doc of tender.documents) {
          if (doc.extractionStatus === 'success') result.pdfExtracted++;
          if (doc.extractionStatus === 'failed') result.pdfFailed++;
        }
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    results.push(result);
  }

  for (const source of customSources) {
    if (!source.enabled) continue;

    const result: ScrapeResult = {
      source: source.name,
      totalScraped: 0,
      newTenders: 0,
      duplicatesSkipped: 0,
      pdfExtracted: 0,
      pdfFailed: 0,
      errors: [],
      scrapedAt: new Date().toISOString(),
      categoriesScraped: [],
    };

    try {
      const tenders = await scrapeGenericUrl(source.url);
      result.totalScraped = tenders.length;

      for (const tender of tenders) {
        const key = generateTenderKey(tender);
        if (scrapedTenderCache.has(key)) {
          result.duplicatesSkipped++;
          if (addScrapedTenderToCache(tender)) changed = true;
        } else {
          addScrapedTenderToCache(tender);
          result.newTenders++;
          changed = true;
        }
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    results.push(result);
  }

  scrapeHistory.push(...results);
  if (changed) persistScrapedTenderCache();
  return results;
}

/**
 * Scrape a single source by name, optionally filtered by categories.
 */
export async function runScrapeSingle(sourceName: string, options?: ScrapeOptions): Promise<ScrapeResult> {
  hydrateScrapedTenderCache();
  const config = findScraperConfig(sourceName);
  let changed = false;

  const result: ScrapeResult = {
    source: sourceName,
    totalScraped: 0,
    newTenders: 0,
    duplicatesSkipped: 0,
    pdfExtracted: 0,
    pdfFailed: 0,
    errors: [],
    scrapedAt: new Date().toISOString(),
    categoriesScraped: options?.categories ?? [],
  };

  try {
    let tenders: ScrapedTender[];

    if (config) {
      tenders = await config.scrapeFunction(config, options);
      result.source = config.name;
    } else {
      const custom = findCustomSource(sourceName);
      if (!custom) throw new Error(`Source "${sourceName}" not found`);
      tenders = await scrapeGenericUrl(custom.url);
      result.source = custom.name;
    }

    result.totalScraped = tenders.length;

    for (const tender of tenders) {
      const key = generateTenderKey(tender);
      if (scrapedTenderCache.has(key)) {
        result.duplicatesSkipped++;
        if (addScrapedTenderToCache(tender)) changed = true;
      } else {
        addScrapedTenderToCache(tender);
        result.newTenders++;
        changed = true;
      }
      for (const doc of tender.documents) {
        if (doc.extractionStatus === 'success') result.pdfExtracted++;
        if (doc.extractionStatus === 'failed') result.pdfFailed++;
      }
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  scrapeHistory.push(result);
  if (changed) persistScrapedTenderCache();
  return result;
}

/**
 * Scrape tenders filtered by a company's selected categories.
 * This is the main entry point for category-based scraping —
 * uses the categories the company selected at sign-up to only
 * fetch relevant tenders from all sources.
 */
export async function scrapeForCompanyCategories(companyCategories: string[]): Promise<ScrapeResult[]> {
  if (!companyCategories.length) {
    return runScrapeAll();
  }
  return runScrapeAll({ categories: companyCategories, extractPdfs: true, scrapeDetails: true });
}
