import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google.internal.',
]);

function ipv4ToParts(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

/** True for loopback, private, link-local, and cloud-metadata addresses. */
export function isBlockedIp(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  const mapped = ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;

  if (mapped === '::1' || mapped === '0:0:0:0:0:0:0:1') return true;
  if (mapped.startsWith('fe80:') || mapped.startsWith('fc') || mapped.startsWith('fd')) return true;

  const parts = ipv4ToParts(mapped);
  if (!parts) return ip.includes(':') ? false : true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function blockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(`${host}.`)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  return false;
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeUrlError('Only http and https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('URLs with embedded credentials are not allowed');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!hostname || blockedHostname(hostname)) {
    throw new UnsafeUrlError('Host is not allowed');
  }

  const addresses = isIP(hostname) ? [hostname] : (await lookup(hostname, { all: true })).map((entry) => entry.address);
  if (addresses.length === 0 || addresses.some((address) => isBlockedIp(address))) {
    throw new UnsafeUrlError('Address is not allowed');
  }
  return url;
}

const DEFAULT_HEADERS = {
  'User-Agent': 'TenderGuard-Pro/1.0 (+https://tenderguard.co.za)',
};

/**
 * Fetch a public URL and refuse redirects onto private or metadata hosts.
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  let current = (await assertPublicHttpUrl(rawUrl)).toString();
  for (let hop = 0; hop <= 3; hop += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(current, {
        ...init,
        redirect: 'manual',
        signal: controller.signal,
        headers: { ...DEFAULT_HEADERS, ...(init.headers ?? {}) },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new UnsafeUrlError('Redirect missing location');
        current = (await assertPublicHttpUrl(new URL(location, current).toString())).toString();
        continue;
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new UnsafeUrlError('Too many redirects');
}
