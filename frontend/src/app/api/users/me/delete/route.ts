import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/apiAuth';
import { requestUserDeletion } from '@/lib/server/firestoreService';
import { revokeAuthUserSessions } from '@/lib/server/firebaseAdmin';
import { extractRequestContext, logSecurityEvent, SecurityEventType } from '@/lib/server/securityAudit';

export async function POST(req: Request) {
  const { user, error } = await requireAuth(req);
  if (error) return error;
  const result = await requestUserDeletion(user!.id);
  await revokeAuthUserSessions(user!.id);
  await logSecurityEvent({
    type: SecurityEventType.DATA_DELETE,
    userId: user!.id,
    userEmail: user!.email,
    userRole: user!.role,
    outcome: 'success',
    resourceType: 'user_account',
    resourceId: user!.id,
    ...extractRequestContext(req),
    details: { action: 'popia_deletion_requested', ...result },
  });
  return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
}
