import type { ScrapedTender } from './tenderScraper';

const SECTION_STOP = /^(?:contact|closing|submission|evaluation|documents?|briefing|scope|description|special conditions?|terms? of reference)\b/i;

function cleanLine(value: string): string {
  return value.replace(/^[\s•*\-–—\d.)]+/, '').replace(/\s+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(cleanLine).filter((value) => value.length >= 5 && value.length <= 500))];
}

function extractSection(lines: string[], headings: RegExp[]): string[] {
  for (let index = 0; index < lines.length; index++) {
    const heading = headings.find((candidate) => candidate.test(lines[index]));
    if (!heading) continue;

    const inline = lines[index].replace(heading, '').replace(/^\s*[:\-–—]\s*/, '').trim();
    const result = inline ? [inline] : [];
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 30); cursor++) {
      const line = lines[cursor].trim();
      if (!line) {
        if (result.length) break;
        continue;
      }
      if (SECTION_STOP.test(line) || headings.some((candidate) => candidate.test(line))) break;
      result.push(line);
    }
    if (result.length) return unique(result);
  }
  return [];
}

function extractKeywordLines(lines: string[], pattern: RegExp): string[] {
  return unique(lines.filter((line) => pattern.test(line)).slice(0, 20));
}

function validDate(value: string): string {
  if (!value || /^0001-01-01/.test(value)) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

/**
 * Converts tender notice and document text into fields used by discovery and readiness scoring.
 * This is deliberately deterministic: extracted claims remain traceable to source text and can
 * be replaced by a higher-confidence model result later.
 */
export function enrichScrapedTender(tender: ScrapedTender): ScrapedTender {
  const documentText = tender.documents.map((document) => document.extractedText).filter(Boolean).join('\n');
  const sourceText = [tender.fullText, tender.description, tender.specialConditions, documentText]
    .filter(Boolean)
    .join('\n');
  const lines = sourceText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (!tender.requirements.length) {
    const section = extractSection(lines, [
      /^mandatory requirements?\b/i,
      /^minimum requirements?\b/i,
      /^returnable documents?\b/i,
      /^requirements?\b/i,
    ]);
    tender.requirements = section.length ? section : extractKeywordLines(lines, /\b(?:must|shall|required|compulsory|mandatory|submit|attach|provide)\b/i);
  }

  if (!tender.eligibilityCriteria.length) {
    const section = extractSection(lines, [
      /^eligibility criteria\b/i,
      /^minimum eligibility\b/i,
      /^qualification criteria\b/i,
      /^pre-qualification criteria\b/i,
      /^functionality criteria\b/i,
    ]);
    tender.eligibilityCriteria = section.length
      ? section
      : extractKeywordLines(lines, /\b(?:eligible|eligibility|qualify|qualification|minimum threshold|cidb|b-bbee|bbbee|csd|tax compliant)\b/i);
  }

  if (!tender.briefing.hasBriefingSession) {
    tender.briefing.hasBriefingSession = /\b(?:briefing session|site meeting|site inspection)\b/i.test(sourceText);
  }
  if (tender.briefing.hasBriefingSession) {
    tender.briefing.isCompulsory = tender.briefing.isCompulsory || /\bcompulsory\b[\s\S]{0,80}\b(?:briefing|meeting|inspection)\b|\b(?:briefing|meeting|inspection)\b[\s\S]{0,80}\bcompulsory\b/i.test(sourceText);
    const dateMatch = sourceText.match(/(?:briefing|site meeting|site inspection)[\s\S]{0,180}?(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}(?:\s+(?:at\s+)?\d{1,2}[:h]\d{2})?)/i);
    const venueMatch = sourceText.match(/(?:briefing venue|venue for (?:the )?(?:briefing|site meeting)|site meeting venue)\s*[:\-]?\s*([^\n]{5,250})/i);
    if (!tender.briefing.date && dateMatch) tender.briefing.date = validDate(dateMatch[1]);
    if (!tender.briefing.venue && venueMatch) tender.briefing.venue = cleanLine(venueMatch[1]);
  }

  tender.requirements = unique(tender.requirements).slice(0, 30);
  tender.eligibilityCriteria = unique(tender.eligibilityCriteria).slice(0, 30);
  return tender;
}
