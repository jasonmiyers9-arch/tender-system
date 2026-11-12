import { describe, expect, it } from 'vitest';
import { assertPublicHttpUrl, isBlockedIp, UnsafeUrlError } from './safeUrl';

describe('isBlockedIp', () => {
  it('blocks loopback, private, link-local, and metadata ranges', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('10.1.2.3')).toBe(true);
    expect(isBlockedIp('192.168.0.5')).toBe(true);
    expect(isBlockedIp('172.16.0.1')).toBe(true);
    expect(isBlockedIp('169.254.169.254')).toBe(true);
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('1.1.1.1')).toBe(false);
  });
});

describe('assertPublicHttpUrl', () => {
  it('rejects non-http schemes, credentials, and local hosts without a lookup', async () => {
    await expect(assertPublicHttpUrl('file:///etc/passwd')).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicHttpUrl('http://user:pass@example.com/')).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicHttpUrl('http://127.0.0.1/latest/meta-data')).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicHttpUrl('http://169.254.169.254/')).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicHttpUrl('http://localhost/admin')).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicHttpUrl('http://metadata.google.internal/')).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
