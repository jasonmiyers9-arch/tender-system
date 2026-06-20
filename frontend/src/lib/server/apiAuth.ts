import { NextResponse } from 'next/server';
import { getUserByToken, listCompaniesForUser, ensureUserCompanyContext } from './firestoreService';
import { logAccessDenied } from './securityAudit';
import { isFirestoreAvailable } from './firebaseAdmin';

export function parseBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : null;
}

/**
 * Authenticate request and return the user. Returns an error response if unauthenticated.
 */
export async function requireAuth(req: Request) {
  if (process.env.NODE_ENV === 'production' && !isFirestoreAvailable()) {
    return { user: null, error: NextResponse.json({ detail: 'Firebase persistence unavailable' }, { status: 503 }) };
  }
  const token = parseBearerToken(req);
  if (!token) {
    await logAccessDenied(req, null, 'Missing authentication token');
    return { user: null, error: NextResponse.json({ detail: 'Unauthorized' }, { status: 401 }) };
  }

  const user = await getUserByToken(token);
  if (!user) {
    await logAccessDenied(req, null, 'Invalid or expired token');
    return { user: null, error: NextResponse.json({ detail: 'Unauthorized' }, { status: 401 }) };
  }

  if (user.isActive === false || user.deletionRequestedAt) {
    await logAccessDenied(req, user.id, 'Account is inactive or pending deletion');
    return { user: null, error: NextResponse.json({ detail: 'Account inactive' }, { status: 403 }) };
  }

  return { user, error: null };
}

/**
 * Authenticate and enforce one of the allowed roles.
 */
export async function requireRole(req: Request, roles: string[]) {
  const { user, error } = await requireAuth(req);
  if (error) return { user: null, error };

  const effectiveRoles = user!.role === 'super_admin' ? ['super_admin', 'admin'] : [user!.role];
  if (!roles.some((role) => effectiveRoles.includes(role))) {
    await logAccessDenied(req, user!.id, `Insufficient role: required ${roles.join('|')}, has ${user!.role}`);
    return { user: null, error: NextResponse.json({ detail: 'Forbidden' }, { status: 403 }) };
  }

  return { user, error: null };
}

export async function requireAdmin(req: Request) {
  return requireRole(req, ['admin']);
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/**
 * Resolve the active company for an authenticated user.
 * Falls back to the first company or auto-creates one.
 */
export async function resolveCompanyContext(userId: string, activeCompanyId: string | null | undefined) {
  if (activeCompanyId) return activeCompanyId;

  const companies = await listCompaniesForUser(userId);
  if (companies[0]?.id) return companies[0].id;

  const ensured = await ensureUserCompanyContext(userId);
  return ensured?.id ?? null;
}
