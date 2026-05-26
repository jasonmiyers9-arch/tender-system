import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import { getDocumentById, getUserByToken } from '@/lib/server/firestoreService';
import { isFirebaseStorageConfigured, downloadDocumentFromFirebase, isLocalStorageReference } from '@/lib/server/firebaseStorage';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByToken(token);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ detail: 'Admin only' }, { status: 403 });
  }

  const { documentId } = await params;
  const document = await getDocumentById(documentId);
  if (!document) {
    return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
  }

  if (!document.fileUrl) {
    return NextResponse.json({ detail: 'No file available' }, { status: 404 });
  }

  if (!isLocalStorageReference(document.fileUrl) && isFirebaseStorageConfigured()) {
    const { buffer, contentType } = await downloadDocumentFromFirebase(document.fileUrl);
    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${document.name}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  if (fs.existsSync(document.fileUrl)) {
    const stream = fs.createReadStream(document.fileUrl);
    return new Response(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': document.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${document.name}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return NextResponse.json({ detail: 'File unavailable' }, { status: 404 });
}
