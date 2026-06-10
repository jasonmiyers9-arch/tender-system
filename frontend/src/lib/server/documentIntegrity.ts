import { createHash } from 'node:crypto';
import type { InternalDocument } from './mockData';

export function calculateSha256(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function verifyDocumentHash(document: Pick<InternalDocument, 'fileHash'>, buffer: Buffer | Uint8Array): {
  ok: boolean;
  expected: string | null;
  actual: string;
} {
  const actual = calculateSha256(buffer);
  const expected = document.fileHash ?? null;
  return {
    ok: !expected || expected === actual,
    expected,
    actual,
  };
}
