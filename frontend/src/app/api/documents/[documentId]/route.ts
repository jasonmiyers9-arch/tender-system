import { NextResponse } from 'next/server';
import { 
  getDocumentById, 
  verifyDocument, 
  getUserByToken,
  listCompaniesForUser,
  updateDocument,
  deleteDocument 
} from '@/lib/server/firestoreService';
import { deleteDocumentFromStorage } from '@/lib/server/firebaseAdmin';
import { reExtractDocumentAi } from '@/lib/server/documentAi';
import { publishRescoreEvent } from '@/lib/server/analystEngine';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

/**
 * GET /api/documents/[documentId]
 * Retrieve a single document by ID
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  let activeCompanyId = user.activeCompanyId;
  if (!activeCompanyId) {
    const companies = await listCompaniesForUser(user.id);
    activeCompanyId = companies[0]?.id;
  }

  if (!activeCompanyId) {
    return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
  }

  const { documentId } = await params;
  const document = await getDocumentById(documentId);
  if (!document) {
    return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
  }

  if (document.companyId !== activeCompanyId) {
    return NextResponse.json({ detail: 'Access denied' }, { status: 403 });
  }

  return NextResponse.json(document);
}

/**
 * POST /api/documents/[documentId]
 * Supported actions:
 * - verify (admin only)
 * - reextract (admin or owning company user)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { documentId } = await params;
  const body = await req.json();
  const action = String(body.action ?? '').trim();

  if (action === 'verify') {
    if (user.role !== 'admin') {
      return NextResponse.json({ detail: 'Admin only' }, { status: 403 });
    }
    const updated = await verifyDocument(documentId, user.id);
    await publishRescoreEvent({
      eventType: 'document.verified',
      companyId: updated.companyId,
      actorUserId: user.id,
      metadata: { documentId: updated.id, status: updated.status },
    });
    return NextResponse.json(updated);
  }

  if (action === 'reextract') {
    const document = await getDocumentById(documentId);
    if (!document) {
      return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
    }

    if (user.role !== 'admin') {
      let activeCompanyId = user.activeCompanyId;
      if (!activeCompanyId) {
        const companies = await listCompaniesForUser(user.id);
        activeCompanyId = companies[0]?.id;
      }
      if (!activeCompanyId || document.companyId !== activeCompanyId) {
        return NextResponse.json({ detail: 'Access denied' }, { status: 403 });
      }
    }

    const result = await reExtractDocumentAi(documentId, user.id);
    const refreshed = await getDocumentById(documentId);
    return NextResponse.json({
      ok: result.ok,
      extractionStatus: result.extractionStatus,
      extractionError: result.error ?? null,
      document: refreshed,
    });
  }

  return NextResponse.json({ detail: 'Unknown action' }, { status: 400 });
}

/**
 * PUT /api/documents/[documentId]
 * Update document metadata
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const token = parseToken(req);
  
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await getUserByToken(token);
    if (!user) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    // Get user's companies to verify access
    let activeCompanyId = user.activeCompanyId;
    if (!activeCompanyId) {
      const companies = await listCompaniesForUser(user.id);
      activeCompanyId = companies[0]?.id;
    }

    if (!activeCompanyId) {
      return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
    }

    const document = await getDocumentById(documentId);
    
    if (!document) {
      return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
    }

    // Verify user has access to this document's company
    if (document.companyId !== activeCompanyId) {
      return NextResponse.json({ detail: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    
    // Only allow updating certain fields
    const allowedUpdates: Record<string, unknown> = {};
    if (body.name !== undefined) allowedUpdates.name = body.name;
    if (body.category !== undefined) allowedUpdates.category = body.category;
    if (body.expiryDate !== undefined) allowedUpdates.expiryDate = body.expiryDate;
    if (body.verified !== undefined && user.role === 'admin') {
      allowedUpdates.verified = body.verified;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ detail: 'No valid updates provided' }, { status: 400 });
    }

    const updatedDocument = await updateDocument(documentId, allowedUpdates);

    await publishRescoreEvent({
      eventType: 'document.verified',
      companyId: updatedDocument.companyId,
      actorUserId: user.id,
      metadata: { documentId: updatedDocument.id, updates: Object.keys(allowedUpdates) },
    });

    return NextResponse.json(updatedDocument);
  } catch (error) {
    console.error('PUT /api/documents/[documentId] error:', error);
    return NextResponse.json({ detail: 'Failed to update document' }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/[documentId]
 * Delete a document and its storage file
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const token = parseToken(req);
  
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await getUserByToken(token);
    if (!user) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    // Get user's companies to verify access
    let activeCompanyId = user.activeCompanyId;
    if (!activeCompanyId) {
      const companies = await listCompaniesForUser(user.id);
      activeCompanyId = companies[0]?.id;
    }

    if (!activeCompanyId) {
      return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
    }

    const document = await getDocumentById(documentId);
    
    if (!document) {
      return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
    }

    // Verify user has access to this document's company
    if (document.companyId !== activeCompanyId) {
      return NextResponse.json({ detail: 'Access denied' }, { status: 403 });
    }

    // Delete from Firebase Storage first
    if (document.storagePath) {
      try {
        await deleteDocumentFromStorage(document.storagePath);
      } catch (storageError) {
        console.warn('Failed to delete storage file:', storageError);
        // Continue with document deletion even if storage deletion fails
      }
    }

    // Delete from Firestore
    await deleteDocument(documentId);
    
    return NextResponse.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('DELETE /api/documents/[documentId] error:', error);
    return NextResponse.json({ detail: 'Failed to delete document' }, { status: 500 });
  }
}
