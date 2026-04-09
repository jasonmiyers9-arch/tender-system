import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import { getDocumentById, getUserByToken, listCompaniesForUser } from '../../../../../lib/server/firestoreService';
import { isFirebaseStorageConfigured, downloadDocumentFromFirebase } from '../../../../../lib/server/firebaseStorage';

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

  try {
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
    if (!document || document.companyId !== activeCompanyId) {
      return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
    }

    const fileUrl = document.fileUrl;
    if (!fileUrl) {
      return NextResponse.json({ detail: 'No file available' }, { status: 404 });
    }

    if (isFirebaseStorageConfigured()) {
      const { buffer, contentType } = await downloadDocumentFromFirebase(fileUrl);
      return new Response(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${document.name}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    if (fs.existsSync(fileUrl)) {
      const stream = fs.createReadStream(fileUrl);
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
  } catch (error) {
    console.error('GET /api/documents/[documentId]/download error:', error);
    return NextResponse.json({ detail: 'Failed to download document' }, { status: 500 });
  }
}
