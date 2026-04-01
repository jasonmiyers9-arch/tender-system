import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

let firestore: Firestore | null = null;
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
      });
    }
    firestore = admin.firestore();
    initialized = true;
  } catch (error) {
    console.warn('Firebase Admin initialization failed:', error);
    firestore = null;
    initialized = false;
  }
}

export function getFirestore() {
  return firestore;
}

export function isFirestoreAvailable() {
  return initialized && firestore !== null;
}

export function requireFirestore() {
  const db = getFirestore();
  if (!db) {
    throw new Error('Firestore is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  }
  return db;
}

export async function verifyIdToken(idToken: string) {
  if (!initialized || !admin.apps.length) {
    throw new Error('Firebase Admin is not configured for token verification.');
  }
  return admin.auth().verifyIdToken(idToken);
}
