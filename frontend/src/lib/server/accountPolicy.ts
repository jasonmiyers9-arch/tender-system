import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export type AccountRole = 'user' | 'evaluator' | 'admin' | 'super_admin';

const SCRYPT_KEYLEN = 32;

/**
 * Public registration can create a company user or an evaluator.
 * Admin roles are only available to the internal provisioning path.
 */
export function resolveRegistrationRole(role: string, privileged = false): AccountRole {
  const normalized = role.trim().toLowerCase();
  if (privileged) {
    if (normalized === 'super_admin') return 'super_admin';
    if (normalized === 'admin') return 'admin';
    if (normalized === 'evaluator' || normalized === 'tender_provider') return 'evaluator';
    return 'user';
  }
  if (normalized === 'admin' || normalized === 'super_admin') {
    throw new Error('admin_registration_disabled');
  }
  if (normalized === 'evaluator' || normalized === 'tender_provider') return 'evaluator';
  return 'user';
}

/** Production self-serve accounts stay pending until an admin approves them. */
export function initialVerificationStatus(privileged = false): 'approved' | 'pending' {
  if (privileged || process.env.NODE_ENV !== 'production') return 'approved';
  return 'pending';
}

export function accountAccessDetail(user: {
  verificationStatus?: string | null;
  isActive?: boolean;
  deletionRequestedAt?: string | null;
}): string | null {
  if (user.isActive === false || user.deletionRequestedAt) return 'account_inactive';
  if (user.verificationStatus === 'pending') return 'account_pending';
  if (user.verificationStatus === 'rejected') return 'account_rejected';
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

const LOCAL_SESSION_PREFIX = 'local';

function localSessionSecret(): string {
  return process.env.LOCAL_SESSION_SECRET || 'tenderguard-dev-session';
}

/** Signed local-dev session. This is not a Firebase uid and is rejected in production. */
export function signLocalDevSession(userId: string): string {
  const sig = createHmac('sha256', localSessionSecret()).update(userId).digest('base64url');
  return `${LOCAL_SESSION_PREFIX}.${userId}.${sig}`;
}

export function readLocalDevSession(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== LOCAL_SESSION_PREFIX || !parts[1] || !parts[2]) return null;
  const expected = createHmac('sha256', localSessionSecret()).update(parts[1]).digest('base64url');
  const actual = Buffer.from(parts[2]);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  return parts[1];
}

export function verifyStoredPassword(password: string, stored: string | null | undefined): boolean {
  if (!password || !stored) return false;
  const [scheme, salt, expectedHex] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}
