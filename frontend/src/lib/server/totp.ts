import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_PERIOD_SECONDS = 30;
const DEFAULT_DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(secret: string): Buffer {
  const normalized = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = '';
  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) throw new Error('Invalid TOTP secret');
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function buildTotpUri(input: { secret: string; accountName: string; issuer?: string }): string {
  const issuer = input.issuer || 'TenderGuard Pro';
  const label = `${issuer}:${input.accountName}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DEFAULT_DIGITS),
    period: String(DEFAULT_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** DEFAULT_DIGITS).padStart(DEFAULT_DIGITS, '0');
}

export function verifyTotpCode(input: { secret: string; code: string; window?: number; now?: number }): boolean {
  const code = input.code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return false;

  const currentCounter = Math.floor((input.now ?? Date.now()) / 1000 / DEFAULT_PERIOD_SECONDS);
  const drift = input.window ?? 1;
  const provided = Buffer.from(code);

  for (let offset = -drift; offset <= drift; offset++) {
    const expected = Buffer.from(hotp(input.secret, currentCounter + offset));
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return true;
    }
  }

  return false;
}
