import admin from 'firebase-admin';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
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
const storageBucket = normalizeBucket(process.env.FIREBASE_STORAGE_BUCKET ?? 'gs://tender-f8e31.firebasestorage.app');

function normalizePrivateKey(key?: string): string | null {
  if (!key) return null;
  let normalized = key.trim();
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.replace(/\\n/g, '\n');
}

function initializeFirebaseAdmin() {
  if (admin.apps.length) {
    return admin;
  }

  const privateKey = normalizePrivateKey(rawPrivateKey);
  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new Error('Firebase admin storage is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_STORAGE_BUCKET.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    storageBucket,
  });

  return admin;
}

function getBucket() {
  const adminApp = initializeFirebaseAdmin();
  return adminApp.storage().bucket(storageBucket);
}

export function isFirebaseStorageConfigured() {
  return !!(projectId && clientEmail && rawPrivateKey && storageBucket);
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

export function writeLocalFallback(blobName: string, data: Buffer): string {
  const storageRoot = path.join(process.cwd(), 'storage');
  const targetPath = path.join(storageRoot, blobName);
  const dir = path.dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(targetPath, data);
  return targetPath;
}
