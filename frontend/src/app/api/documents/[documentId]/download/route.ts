import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import { getDocumentById } from '../../../../../lib/server/firestoreService';
import { isFirebaseStorageConfigured, downloadDocumentFromFirebase, isLocalStorageReference } from '../../../../../lib/server/firebaseStorage';
import { requireAuth, resolveCompanyContext } from '../../../../../lib/server/apiAuth';
import { verifyDocumentHash } from '../../../../../lib/server/documentIntegrity';

function tamperResponse(expected: string | null, actual: string): NextResponse {
  return NextResponse.json(
    {
      detail: 'Document integrity check failed',
      expectedHash: expected,
      actualHash: actual,
    },
    { status: 409 },
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    const activeCompanyId = await resolveCompanyContext(user!.id, user!.activeCompanyId);

    if (!activeCompanyId) {
      return NextResponse.json({ detail: 'Company context required' }, { status: 400 });
    }

    const { documentId } = await params;
    const document = await getDocumentById(documentId);
    if (!document || document.companyId !== activeCompanyId) {
      return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
    }

    const fileUrl = document.fileUrl;
    if (!fileUrl) {
      return NextResponse.json({ detail: 'No file available' }, { status: 404 });
    }

    if (!isLocalStorageReference(fileUrl) && isFirebaseStorageConfigured()) {
      const { buffer, contentType } = await downloadDocumentFromFirebase(fileUrl);
      const integrity = verifyDocumentHash(document, buffer);
      if (!integrity.ok) return tamperResponse(integrity.expected, integrity.actual);

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${document.name}"`,
          'Cache-Control': 'private, no-store',
          'X-Document-SHA256': integrity.actual,
        },
      });
    }

    if (fs.existsSync(fileUrl)) {
      const buffer = fs.readFileSync(fileUrl);
      const integrity = verifyDocumentHash(document, buffer);
      if (!integrity.ok) return tamperResponse(integrity.expected, integrity.actual);

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${document.name}"`,
          'Cache-Control': 'private, no-store',
          'X-Document-SHA256': integrity.actual,
        },
      });
    }

    return NextResponse.json({ detail: 'File unavailable' }, { status: 404 });
  } catch (error) {
    console.error('GET /api/documents/[documentId]/download error:', error);
    return NextResponse.json({ detail: 'Failed to download document' }, { status: 500 });
  }
}
