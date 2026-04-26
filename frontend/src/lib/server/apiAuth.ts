import { NextResponse } from 'next/server';
import { getUserByToken, listCompaniesForUser, ensureUserCompanyContext } from './firestoreService';
import { logAccessDenied } from './securityAudit';

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

  return { user, error: null };
}

/**
 * Authenticate and enforce one of the allowed roles.
 */
export async function requireRole(req: Request, roles: string[]) {
  const { user, error } = await requireAuth(req);
  if (error) return { user: null, error };

  if (!roles.includes(user!.role)) {
    await logAccessDenied(req, user!.id, `Insufficient role: required ${roles.join('|')}, has ${user!.role}`);
    return { user: null, error: NextResponse.json({ detail: 'Forbidden' }, { status: 403 }) };
  }

  return { user, error: null };
}

export async function requireAdmin(req: Request) {
  return requireRole(req, ['admin']);
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
