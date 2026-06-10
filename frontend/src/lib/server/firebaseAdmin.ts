import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

let firestore: Firestore | null = null;
let bucket: Bucket | null = null;
let initialized = false;

if (projectId && clientEmail && privateKey) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket: storageBucket,
      });
    }
    firestore = admin.firestore();
    firestore.settings({ ignoreUndefinedProperties: true });
    if (storageBucket) {
      bucket = admin.storage().bucket();
    }
    initialized = true;
  } catch (error) {
    console.warn('Firebase Admin initialization failed:', error);
    firestore = null;
    bucket = null;
    initialized = false;
  }
}

export function getFirestore() {
  return firestore;
}

export function getStorageBucket() {
  return bucket;
}

export function isFirestoreAvailable() {
  return initialized && firestore !== null;
}

export function isStorageAvailable() {
  return initialized && bucket !== null;
}

export function isFirebaseAdminConfigured() {
  return initialized && admin.apps.length > 0;
}

export function requireFirestore() {
  const db = getFirestore();
  if (!db) {
    throw new Error('Firestore is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  }
  return db;
}

export function requireStorage() {
  const storage = getStorageBucket();
  if (!storage) {
    throw new Error('Firebase Storage is not configured. Set FIREBASE_STORAGE_BUCKET.');
  }
  return storage;
}

/**
 * Delete a document from Firebase Storage
 * @param storagePath - The path to the file in storage (e.g., "companies/123/documents/file.pdf")
 */
export async function deleteDocumentFromStorage(storagePath: string): Promise<void> {
  const storage = requireStorage();
  const file = storage.file(storagePath);
  await file.delete();
}

/**
 * Upload a file to Firebase Storage
 * @param storagePath - The path to store the file
 * @param buffer - The file content as a Buffer
 * @param contentType - The MIME type of the file
 * @returns The public URL or signed URL of the uploaded file
 */
export async function uploadToStorage(
  storagePath: string, 
  buffer: Buffer, 
  contentType: string
): Promise<{ url: string; storagePath: string }> {
  const storage = requireStorage();
  const file = storage.file(storagePath);
  
  await file.save(buffer, {
    metadata: {
      contentType,
    },
  });
  
  // Generate a signed URL that expires in 7 days
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  
  return { url, storagePath };
}

/**
 * Get a download URL for a file in storage
 * @param storagePath - The path to the file in storage
 * @returns A signed download URL
 */
export async function getDownloadUrl(storagePath: string): Promise<string> {
  const storage = requireStorage();
  const file = storage.file(storagePath);
  
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  
  return url;
}

export async function verifyIdToken(idToken: string) {
  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured for token verification.');
  }
  return admin.auth().verifyIdToken(idToken);
}

export async function createEmailPasswordUser(payload: {
  email: string;
  password: string;
  displayName: string;
}) {
  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured for user provisioning.');
  }

  return admin.auth().createUser({
    email: payload.email,
    password: payload.password,
    displayName: payload.displayName,
  });
}

export async function deleteAuthUser(uid: string) {
  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured for user provisioning.');
  }

  await admin.auth().deleteUser(uid);
}

export async function generatePasswordResetLink(email: string): Promise<string> {
  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured for password reset.');
  }
  return admin.auth().generatePasswordResetLink(email);
}

export async function generateEmailVerificationLink(email: string): Promise<string> {
  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured for email verification.');
  }
  return admin.auth().generateEmailVerificationLink(email);
}
