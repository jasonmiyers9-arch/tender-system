import { NextResponse } from 'next/server';
import * as path from 'node:path';
import { getUserByToken, listCompaniesForUser, createDocument } from '../../../../lib/server/firestoreService';
import { uploadDocumentToFirebase, isFirebaseStorageConfigured, writeLocalFallback } from '../../../../lib/server/firebaseStorage';
import { enqueueDocumentAiProcessing } from '../../../../lib/server/documentAi';

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.txt', '.csv', '.zip',
]);
const ALLOWED_CATEGORIES = new Set(['tax', 'legal', 'financial', 'certification', 'bbbee', 'registration'] as const);

type DocumentCategory = 'tax' | 'legal' | 'financial' | 'certification' | 'bbbee' | 'registration';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

export async function POST(req: Request) {
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

    const formData = await req.formData();
  const file = formData.get('file');
  const category = String(formData.get('category') || '').trim();

  if (!file || typeof (file as any).arrayBuffer !== 'function') {
    return NextResponse.json({ detail: 'File upload is required' }, { status: 400 });
  }

  const filename = String((file as any).name || 'document.bin');
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { detail: `File type '${ext}' is not allowed.` },
      { status: 400 },
    );
  }

  const documentCategory = ALLOWED_CATEGORIES.has(category as DocumentCategory)
    ? (category as DocumentCategory)
    : 'tax';

  const buffer = Buffer.from(await (file as any).arrayBuffer());
  const safeFileName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `company_${activeCompanyId}/${Date.now()}_${safeFileName}`;

  let fileUrl: string;
  try {
    if (isFirebaseStorageConfigured()) {
      fileUrl = await uploadDocumentToFirebase(storageKey, buffer, (file as any).type || 'application/octet-stream');
    } else {
      fileUrl = writeLocalFallback(storageKey, buffer);
    }
  } catch (error) {
    return NextResponse.json({ detail: 'Failed to save document to storage.' }, { status: 500 });
  }

    const document = await createDocument({
      companyId: activeCompanyId,
      name: safeFileName,
      category: documentCategory,
      fileUrl,
      expiryDate: null,
    });

    enqueueDocumentAiProcessing(document.id, storageKey, activeCompanyId);

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('POST /api/documents/upload error:', error);
    return NextResponse.json({ detail: 'Failed to upload document' }, { status: 500 });
  }
}
