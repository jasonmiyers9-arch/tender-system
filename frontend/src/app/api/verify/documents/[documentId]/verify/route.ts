import { NextResponse } from 'next/server';
import { getCompanyById, verifyDocument } from '@/lib/server/firestoreService';
import { publishRescoreEvent } from '@/lib/server/analystEngine';
import { requireRole } from '@/lib/server/apiAuth';
import { extractRequestContext, logSecurityEvent, SecurityEventType } from '@/lib/server/securityAudit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { user, error } = await requireRole(req, ['evaluator', 'admin']);
  if (error) return error;

  const { documentId } = await params;

  let document;
  try {
    document = await verifyDocument(documentId, user!.id);
  } catch {
    return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
  }

  await publishRescoreEvent({
    eventType: 'document.verified',
    companyId: document.companyId,
    actorUserId: user!.id,
    metadata: { documentId: document.id, status: document.status },
  });

  const company = await getCompanyById(document.companyId);
  await logSecurityEvent({
    type: SecurityEventType.DATA_UPDATE,
    userId: user!.id,
    userEmail: user!.email,
    userRole: user!.role,
    companyId: document.companyId,
    outcome: 'success',
    resourceType: 'document_verification',
    resourceId: documentId,
    ...extractRequestContext(req),
    details: {
      action: 'evaluator_verified_document',
      documentName: document.name,
      documentCategory: document.category,
      companyName: company?.name ?? null,
      verifiedAt: document.verifiedAt,
    },
  });

  return NextResponse.json({ ok: true, status: document.status, verifiedAt: document.verifiedAt });
}
