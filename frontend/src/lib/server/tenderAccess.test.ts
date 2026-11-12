import { describe, expect, it } from 'vitest';
import { isPublishedTender, redactTender, viewerCanSeeUnpublished } from './tenderAccess';

describe('tender visibility', () => {
  it('hides drafts from anonymous viewers and other companies', () => {
    expect(isPublishedTender('published')).toBe(true);
    expect(isPublishedTender('draft')).toBe(false);
    expect(viewerCanSeeUnpublished(undefined, 'owner', undefined)).toBe(false);
    expect(viewerCanSeeUnpublished('user', 'owner', 'someone')).toBe(false);
    expect(viewerCanSeeUnpublished('evaluator', 'owner', 'someone-else')).toBe(false);
    expect(viewerCanSeeUnpublished('evaluator', 'owner', 'owner')).toBe(true);
    expect(viewerCanSeeUnpublished('admin', 'owner', 'admin-1')).toBe(true);
  });

  it('strips contact details from anonymous tender payloads', () => {
    const tender = redactTender({
      id: 't1',
      title: 'Roads',
      contact: { email: 'buyer@example.com' },
      createdBy: 'user-1',
      rejectionReason: 'internal',
    }, false);
    expect(tender.contact).toBeUndefined();
    expect(tender.createdBy).toBeUndefined();
    expect(tender.rejectionReason).toBeUndefined();
    expect(tender.title).toBe('Roads');
  });
});
