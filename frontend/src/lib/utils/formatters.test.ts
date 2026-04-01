import { describe, expect, it } from 'vitest';
import {
  classNames,
  docCategoryLabel,
  daysUntilExpiry,
  scoreFromNumber,
} from './formatters';

describe('formatters', () => {
  it('maps score bands correctly', () => {
    expect(scoreFromNumber(90)).toBe('tender-ready');
    expect(scoreFromNumber(70)).toBe('partially-ready');
    expect(scoreFromNumber(40)).toBe('high-risk');
  });

  it('returns known category labels', () => {
    expect(docCategoryLabel('bbbee')).toBe('B-BBEE');
    expect(docCategoryLabel('tax')).toBe('Tax');
  });

  it('returns null days when no expiry exists', () => {
    expect(daysUntilExpiry(null)).toBeNull();
  });

  it('joins class names safely', () => {
    expect(classNames('a', undefined, false, 'b')).toBe('a b');
  });
});
