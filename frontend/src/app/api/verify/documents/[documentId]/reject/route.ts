import { NextResponse } from 'next/server';
import { publishRescoreEvent } from '@/lib/server/analystEngine';
import { requireRole } from '@/lib/server/apiAuth';
import { setDocumentStatus } from '@/lib/server/firestoreService';
import { extractRequestContext, logSecurityEvent, SecurityEventType } from '@/lib/server/securityAudit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { user, error } = await requireRole(req, ['evaluator', 'admin']);
  if (error) return error;

  const { documentId } = await params;
  try {
    const document = await setDocumentStatus(documentId, 'rejected', user!.id);
    await publishRescoreEvent({
      eventType: 'document.verified',
      companyId: document.companyId,
      actorUserId: user!.id,
      metadata: { documentId: document.id, status: document.status },
    });
    await logSecurityEvent({
      type: SecurityEventType.DATA_UPDATE,
      userId: user!.id,
      userEmail: user!.email,
      userRole: user!.role,
      companyId: document.companyId,
      outcome: 'success',
      resourceType: 'document',
      resourceId: document.id,
      ...extractRequestContext(req),
      details: { action: 'evaluator_document_rejected', documentName: document.name },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Document rejection failed';
    return NextResponse.json({ detail: message }, { status: message === 'Document not found' ? 404 : 500 });
  }
}