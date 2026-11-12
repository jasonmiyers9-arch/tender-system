/**
 * MIME Type Validation Service
 * 
 * Validates file types using magic bytes (file signatures) rather than
 * just file extensions, preventing spoofed file uploads.
 */

interface MagicSignature {
  bytes: number[];
  offset?: number;
  mask?: number[];
}

interface FileTypeDefinition {
  extension: string;
  mimeTypes: string[];
  signatures: MagicSignature[];
}

/**
 * File type definitions with magic byte signatures
 * Reference: https://en.wikipedia.org/wiki/List_of_file_signatures
 */
const FILE_TYPES: FileTypeDefinition[] = [
  // PDF
  {
    extension: '.pdf',
    mimeTypes: ['application/pdf'],
    signatures: [
      { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
    ],
  },
  // Microsoft Word (DOC - OLE2)
  {
    extension: '.doc',
    mimeTypes: ['application/msword'],
    signatures: [
      { bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }, // OLE2 Compound Document
    ],
  },
  // Microsoft Word (DOCX - ZIP-based OOXML)
  {
    extension: '.docx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    signatures: [
      { bytes: [0x50, 0x4B, 0x03, 0x04] }, // ZIP (PK..)
      { bytes: [0x50, 0x4B, 0x05, 0x06] }, // ZIP (empty archive)
      { bytes: [0x50, 0x4B, 0x07, 0x08] }, // ZIP (spanned archive)
    ],
  },
  // Microsoft Excel (XLS - OLE2)
  {
    extension: '.xls',
    mimeTypes: ['application/vnd.ms-excel'],
    signatures: [
      { bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }, // OLE2 Compound Document
    ],
  },
  // Microsoft Excel (XLSX - ZIP-based OOXML)
  {
    extension: '.xlsx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    signatures: [
      { bytes: [0x50, 0x4B, 0x03, 0x04] }, // ZIP (PK..)
      { bytes: [0x50, 0x4B, 0x05, 0x06] }, // ZIP (empty archive)
    ],
  },
  // PNG
  {
    extension: '.png',
    mimeTypes: ['image/png'],
    signatures: [
      { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }, // PNG signature
    ],
  },
  // JPEG/JPG
  {
    extension: '.jpg',
    mimeTypes: ['image/jpeg'],
    signatures: [
      { bytes: [0xFF, 0xD8, 0xFF, 0xE0] }, // JPEG JFIF
      { bytes: [0xFF, 0xD8, 0xFF, 0xE1] }, // JPEG Exif
      { bytes: [0xFF, 0xD8, 0xFF, 0xE8] }, // JPEG SPIFF
      { bytes: [0xFF, 0xD8, 0xFF, 0xDB] }, // JPEG raw
      { bytes: [0xFF, 0xD8, 0xFF, 0xEE] }, // JPEG (Adobe)
    ],
  },
  {
    extension: '.jpeg',
    mimeTypes: ['image/jpeg'],
    signatures: [
      { bytes: [0xFF, 0xD8, 0xFF, 0xE0] },
      { bytes: [0xFF, 0xD8, 0xFF, 0xE1] },
      { bytes: [0xFF, 0xD8, 0xFF, 0xE8] },
      { bytes: [0xFF, 0xD8, 0xFF, 0xDB] },
      { bytes: [0xFF, 0xD8, 0xFF, 0xEE] },
    ],
  },
  // Plain text (no magic bytes - needs content analysis)
  {
    extension: '.txt',
    mimeTypes: ['text/plain'],
    signatures: [], // Text files have no specific signature
  },
  // CSV (no magic bytes - needs content analysis)
  {
    extension: '.csv',
    mimeTypes: ['text/csv', 'text/plain', 'application/csv'],
    signatures: [], // CSV files have no specific signature
  },
  // ZIP archive
  {
    extension: '.zip',
    mimeTypes: ['application/zip', 'application/x-zip-compressed'],
    signatures: [
      { bytes: [0x50, 0x4B, 0x03, 0x04] }, // ZIP (PK..)
      { bytes: [0x50, 0x4B, 0x05, 0x06] }, // ZIP (empty archive)
      { bytes: [0x50, 0x4B, 0x07, 0x08] }, // ZIP (spanned archive)
    ],
  },
  // GIF
  {
    extension: '.gif',
    mimeTypes: ['image/gif'],
    signatures: [
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
    ],
  },
  // WebP
  {
    extension: '.webp',
    mimeTypes: ['image/webp'],
    signatures: [
      { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header (full check requires WEBP at offset 8)
    ],
  },
];

// Build lookup maps for performance
const extensionMap = new Map<string, FileTypeDefinition>();
const mimeTypeMap = new Map<string, FileTypeDefinition>();

for (const filetype of FILE_TYPES) {
  extensionMap.set(filetype.extension.toLowerCase(), filetype);
  // Also handle .jpg/.jpeg equivalence
  if (filetype.extension === '.jpg') {
    extensionMap.set('.jpeg', filetype);
  }
  for (const mime of filetype.mimeTypes) {
    mimeTypeMap.set(mime.toLowerCase(), filetype);
  }
}

export interface ValidationResult {
  valid: boolean;
  detectedType: string | null;
  declaredExtension: string;
  declaredMimeType: string;
  reason?: string;
}

/**
 * Check if buffer starts with the given signature bytes
 */
function matchesSignature(buffer: Buffer, signature: MagicSignature): boolean {
  const offset = signature.offset || 0;
  
  if (buffer.length < offset + signature.bytes.length) {
    return false;
  }
  
  for (let i = 0; i < signature.bytes.length; i++) {
    const bufferByte = buffer[offset + i];
    const sigByte = signature.bytes[i];
    const mask = signature.mask?.[i] ?? 0xFF;
    
    if ((bufferByte & mask) !== (sigByte & mask)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Detect file type from magic bytes
 */
export function detectFileType(buffer: Buffer): FileTypeDefinition | null {
  for (const filetype of FILE_TYPES) {
    // Skip types without signatures (like .txt, .csv)
    if (filetype.signatures.length === 0) continue;
    
    for (const sig of filetype.signatures) {
      if (matchesSignature(buffer, sig)) {
        return filetype;
      }
    }
  }
  
  return null;
}

/**
 * Check if content appears to be valid text (for .txt, .csv)
 */
function isValidTextContent(buffer: Buffer, maxBytesToCheck = 8192): boolean {
  const bytesToCheck = Math.min(buffer.length, maxBytesToCheck);
  let invalidBytes = 0;
  
  for (let i = 0; i < bytesToCheck; i++) {
    const byte = buffer[i];
    // Allow printable ASCII, newlines, tabs, and UTF-8 continuation bytes
    const isValid = 
      (byte >= 0x20 && byte <= 0x7E) || // Printable ASCII
      byte === 0x09 || // Tab
      byte === 0x0A || // LF
      byte === 0x0D || // CR
      (byte >= 0x80 && byte <= 0xBF) || // UTF-8 continuation
      (byte >= 0xC2 && byte <= 0xF4);   // UTF-8 start bytes
    
    if (!isValid) {
      invalidBytes++;
    }
  }
  
  // Allow up to 1% invalid bytes (for minor encoding issues)
  return invalidBytes / bytesToCheck < 0.01;
}

/**
 * Validate file type by checking magic bytes against declared extension/MIME type
 * 
 * @param buffer - File content buffer
 * @param declaredExtension - The file extension claimed by the upload (e.g., '.pdf')
 * @param declaredMimeType - The MIME type claimed by the upload
 * @returns Validation result with details
 */
export function validateFileType(
  buffer: Buffer,
  declaredExtension: string,
  declaredMimeType: string
): ValidationResult {
  const ext = declaredExtension.toLowerCase();
  const mime = declaredMimeType.toLowerCase();
  
  // Get the expected file type from extension
  const expectedType = extensionMap.get(ext);
  
  if (!expectedType) {
    return {
      valid: false,
      detectedType: null,
      declaredExtension: ext,
      declaredMimeType: mime,
      reason: `Unsupported file extension: ${ext}`,
    };
  }
  
  // For text-based files without signatures, do content analysis
  if (expectedType.signatures.length === 0) {
    const isText = isValidTextContent(buffer);
    return {
      valid: isText,
      detectedType: isText ? expectedType.extension : null,
      declaredExtension: ext,
      declaredMimeType: mime,
      reason: isText ? undefined : 'File appears to contain binary data, not text',
    };
  }
  
  // Detect the actual file type from magic bytes
  const detectedType = detectFileType(buffer);
  
  if (!detectedType) {
    return {
      valid: false,
      detectedType: null,
      declaredExtension: ext,
      declaredMimeType: mime,
      reason: 'Could not determine file type from content',
    };
  }
  
  // Handle OLE2 format ambiguity (doc/xls share the same signature)
  if (detectedType.signatures[0]?.bytes[0] === 0xD0) {
    // OLE2 format - accept both .doc and .xls
    if (ext === '.doc' || ext === '.xls') {
      return {
        valid: true,
        detectedType: detectedType.extension,
        declaredExtension: ext,
        declaredMimeType: mime,
      };
    }
  }
  
  // Handle ZIP-based formats (docx, xlsx, zip). Office files must contain their
  // document part; a renamed zip archive is not accepted as docx or xlsx.
  const zipBasedExtensions = ['.docx', '.xlsx', '.zip'];
  if (detectedType.extension === '.zip' || zipBasedExtensions.includes(detectedType.extension)) {
    if (zipBasedExtensions.includes(ext)) {
      const officePart = ext === '.docx'
        ? 'word/document.xml'
        : ext === '.xlsx'
          ? 'xl/workbook.xml'
          : null;
      if (officePart && !buffer.includes(Buffer.from(officePart))) {
        return {
          valid: false,
          detectedType: detectedType.extension,
          declaredExtension: ext,
          declaredMimeType: mime,
          reason: `File does not contain ${officePart}`,
        };
      }
      return {
        valid: true,
        detectedType: detectedType.extension,
        declaredExtension: ext,
        declaredMimeType: mime,
      };
    }
  }
  
  // Handle .jpg/.jpeg equivalence
  if ((ext === '.jpg' || ext === '.jpeg') && detectedType.extension === '.jpg') {
    return {
      valid: true,
      detectedType: detectedType.extension,
      declaredExtension: ext,
      declaredMimeType: mime,
    };
  }
  
  // Strict match for other types
  if (detectedType.extension !== ext) {
    return {
      valid: false,
      detectedType: detectedType.extension,
      declaredExtension: ext,
      declaredMimeType: mime,
      reason: `File content (${detectedType.extension}) does not match declared extension (${ext})`,
    };
  }
  
  return {
    valid: true,
    detectedType: detectedType.extension,
    declaredExtension: ext,
    declaredMimeType: mime,
  };
}

/**
 * Quick check if a file extension is in the allowed list
 */
export function isAllowedExtension(extension: string): boolean {
  return extensionMap.has(extension.toLowerCase());
}

/**
 * Get MIME type for an extension
 */
export function getMimeTypeForExtension(extension: string): string | null {
  const filetype = extensionMap.get(extension.toLowerCase());
  return filetype?.mimeTypes[0] || null;
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  const basename = filename.split(/[/\\]/).pop() || 'file';
  
  // Replace unsafe characters
  const safe = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Prevent double extensions that might bypass security
  const parts = safe.split('.');
  if (parts.length > 2) {
    // Keep only first and last parts
    return `${parts[0]}.${parts[parts.length - 1]}`;
  }
  
  // Ensure reasonable length
  if (safe.length > 255) {
    const ext = parts[parts.length - 1];
    const name = parts.slice(0, -1).join('.');
    return `${name.slice(0, 255 - ext.length - 1)}.${ext}`;
  }
  
  return safe;
}

/**
 * Comprehensive file validation for uploads
 */
export function validateUpload(
  buffer: Buffer,
  filename: string,
  declaredMimeType: string,
  maxSize: number = 10 * 1024 * 1024 // 10MB default
): ValidationResult & { sanitizedFilename: string; sizeValid: boolean } {
  const ext = '.' + (filename.split('.').pop() || '').toLowerCase();
  
  // Size check
  const sizeValid = buffer.length <= maxSize;
  
  // Type validation
  const typeResult = validateFileType(buffer, ext, declaredMimeType);
  
  // Filename sanitization
  const sanitizedFilename = sanitizeFilename(filename);
  
  return {
    ...typeResult,
    sanitizedFilename,
    sizeValid,
    reason: !sizeValid 
      ? `File size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds limit (${(maxSize / 1024 / 1024).toFixed(0)}MB)`
      : typeResult.reason,
    valid: typeResult.valid && sizeValid,
  };
}
