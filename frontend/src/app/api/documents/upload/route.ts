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

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ detail: 'File upload is required' }, { status: 400 });
    }
    const uploadedFile = file as File;

    const filename = String(uploadedFile.name || 'document.bin');
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

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const fileSize = buffer.length;
    const mimeType = uploadedFile.type || 'application/octet-stream';
    const safeFileName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `company_${activeCompanyId}/${Date.now()}_${safeFileName}`;

    // Extract PDF content if applicable
    let extractedText: string | undefined;
    let pageCount: number | undefined;
    let documentAnalysis: NonNullable<Parameters<typeof createDocument>[0]['documentAnalysis']> | undefined;
    let detectedExpiryDate: string | null = null;

    if (ext === '.pdf') {
      try {
        // Lazy-load PDF extraction to prevent Netlify/Next build-time evaluation of pdf-parse.
        const { extractPDFContent, analyzeDocumentContent, extractExpiryDate } = await import('../../../../lib/server/pdfExtractor');
        const pdfResult = await extractPDFContent(buffer);
        extractedText = pdfResult.text;
        pageCount = pdfResult.pageCount;
        
        if (extractedText) {
          const analysis = analyzeDocumentContent(extractedText, pageCount);
          documentAnalysis = {
            wordCount: analysis.wordCount,
            hasSignature: analysis.hasSignature,
            hasDate: analysis.hasDate,
            hasCompanyName: analysis.hasCompanyName,
            hasRegistrationNumber: analysis.hasRegistrationNumber,
            hasVatNumber: analysis.hasVatNumber,
            hasBBBEELevel: analysis.hasBBBEELevel,
            detectedDates: analysis.detectedDates,
            detectedAmounts: analysis.detectedAmounts,
            documentType: analysis.documentType,
            confidence: analysis.confidence,
            keywords: analysis.keywords,
          };
          
          // Try to detect expiry date from document
          detectedExpiryDate = extractExpiryDate(extractedText);
        }
        console.log(`PDF extracted: ${pageCount} pages, ${extractedText?.length ?? 0} chars`);
      } catch (pdfError) {
        console.warn('PDF extraction warning:', pdfError);
        // Continue without extraction - document will still be stored
      }
    }

    // Upload to storage
    let fileUrl: string;
    try {
      if (isFirebaseStorageConfigured()) {
        fileUrl = await uploadDocumentToFirebase(storageKey, buffer, mimeType);
        console.log(`Document uploaded to Firebase Storage: ${fileUrl}`);
      } else {
        fileUrl = writeLocalFallback(storageKey, buffer);
        console.log(`Document saved locally: ${fileUrl}`);
      }
    } catch {
      return NextResponse.json({ detail: 'Failed to save document to storage.' }, { status: 500 });
    }

    // Create document record with full metadata
    const document = await createDocument({
      companyId: activeCompanyId,
      name: safeFileName,
      category: documentCategory,
      fileUrl,
      storagePath: storageKey,
      expiryDate: detectedExpiryDate,
      fileSize,
      mimeType,
      pageCount,
      extractedText: extractedText?.slice(0, 50000), // Limit stored text to 50KB
      documentAnalysis,
    });

    // Queue AI processing for further analysis
    enqueueDocumentAiProcessing(document.id, storageKey, activeCompanyId);

    return NextResponse.json({
      ...document,
      message: extractedText 
        ? `Document uploaded and analyzed (${pageCount} pages, ${documentAnalysis?.wordCount ?? 0} words)`
        : 'Document uploaded successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/documents/upload error:', error);
    return NextResponse.json({ detail: 'Failed to upload document' }, { status: 500 });
  }
}
