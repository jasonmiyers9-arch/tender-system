import { describe, expect, it } from 'vitest';
import { resolveScraperUrl } from './tenderScraper';

describe('resolveScraperUrl', () => {
  it('resolves root-relative URLs against a base URL', () => {
    expect(resolveScraperUrl('/documents/spec.pdf', 'https://example.com/tenders/page/2'))
      .toBe('https://example.com/documents/spec.pdf');
  });

  it('resolves path-relative URLs against a base URL', () => {
    expect(resolveScraperUrl('documents/spec.pdf', 'https://example.com/tenders/page/2'))
      .toBe('https://example.com/tenders/page/documents/spec.pdf');
  });

  it('returns null for empty or invalid URLs', () => {
    expect(resolveScraperUrl('', 'https://example.com/tenders/page/2')).toBeNull();
    expect(resolveScraperUrl('   ', 'https://example.com/tenders/page/2')).toBeNull();
    expect(resolveScraperUrl('http://[invalid-url]', 'https://example.com/tenders/page/2')).toBeNull();
  });
});
