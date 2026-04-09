import * as fs from 'node:fs';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { getDocumentById } from '@/lib/server/firestoreService';
import { downloadDocumentFromFirebase, isFirebaseStorageConfigured } from '@/lib/server/firebaseStorage';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { docId } = await params;
  const document = await getDocumentById(docId);
  if (!document || !document.fileUrl) {
    return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
  }

  if (isFirebaseStorageConfigured()) {
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
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${document.name}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return NextResponse.json({ detail: 'File unavailable' }, { status: 404 });
}
