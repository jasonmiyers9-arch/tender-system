import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function normalizeBucket(bucket?: string): string | undefined {
  if (!bucket) return undefined;
  const trimmed = bucket.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('gs://') ? trimmed.slice(5) : trimmed;
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
const storageBucket = normalizeBucket(process.env.FIREBASE_STORAGE_BUCKET);
let cachedLocalStorageRoot: string | null = null;

function normalizePrivateKey(key?: string): string | null {
  if (!key) return null;
  let normalized = key.trim();
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.replace(/\\n/g, '\n');
}

function initializeFirebaseAdmin() {
  if (getApps().length) {
    return getApps()[0];
  }

  const privateKey = normalizePrivateKey(rawPrivateKey);
  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new Error('Firebase admin storage is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_STORAGE_BUCKET.');
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    storageBucket,
  });

}

function getBucket() {
  const adminApp = initializeFirebaseAdmin();
  return getStorage(adminApp as App).bucket(storageBucket);
}

export function isFirebaseStorageConfigured() {
  return !!(projectId && clientEmail && rawPrivateKey && storageBucket);
}

export function isLocalStorageReference(storageRef: string): boolean {
  return path.isAbsolute(storageRef);
}

export async function uploadDocumentToFirebase(blobName: string, data: Buffer, contentType = 'application/octet-stream'): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(blobName);
  await file.save(data, {
    contentType,
    resumable: false,
    metadata: {
      contentType,
    },
  });
  return file.name;
}

export async function generateFirebaseSignedDownloadUrl(blobName: string, expirationSeconds = 900): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(blobName);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error('Storage blob not found');
  }

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expirationSeconds * 1000,
  });
  return url;
}

export async function downloadDocumentFromFirebase(blobName: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const bucket = getBucket();
  const file = bucket.file(blobName);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error('Storage blob not found');
  }

  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();

  return {
    buffer,
    contentType: metadata.contentType || 'application/octet-stream',
  };
}

function resolveLocalStorageRoot(): string {
  if (cachedLocalStorageRoot) {
    return cachedLocalStorageRoot;
  }

  const configuredDir = process.env.LOCAL_STORAGE_DIR?.trim();
  const candidates = [
    configuredDir,
    path.join(process.cwd(), 'storage'),
    path.join(os.tmpdir(), 'tenderguard-storage'),
  ].filter((value): value is string => Boolean(value));

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      const probePath = path.join(candidate, `.write-test-${process.pid}-${Date.now()}`);
      writeFileSync(probePath, '');
      rmSync(probePath, { force: true });
      cachedLocalStorageRoot = candidate;
      return candidate;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `No writable local storage directory available.${lastError instanceof Error ? ` Last error: ${lastError.message}` : ''}`,
  );
}

export function writeLocalFallback(blobName: string, data: Buffer): string {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_LOCAL_STORAGE_FALLBACK === 'false') {
    throw new Error('Local document storage fallback is disabled outside development.');
  }
  const storageRoot = resolveLocalStorageRoot();
  const targetPath = path.join(storageRoot, blobName);
  const dir = path.dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(targetPath, data);
  return targetPath;
}
