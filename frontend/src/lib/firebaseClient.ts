import { initializeApp, getApps } from 'firebase/app';
import {
  GoogleAuthProvider,
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  getAuth,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';

function normalizeBucket(bucket?: string): string | undefined {
  if (!bucket) return undefined;
  const trimmed = bucket.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('gs://') ? trimmed.slice(5) : trimmed;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: normalizeBucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'gs://tender-f8e31.firebasestorage.app'),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function isFirebaseClientConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
}

function ensureFirebaseAuth() {
  if (!isFirebaseClientConfigured()) {
    throw new Error('Firebase client configuration is missing. Set NEXT_PUBLIC_FIREBASE_* environment variables.');
  }

  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }

  return getAuth();
}

const googleProvider = new GoogleAuthProvider();

function mapFirebaseUser(user: User, idToken: string) {
  return {
    idToken,
    uid: user.uid,
    email: user.email,
    fullName: user.displayName || '',
    emailVerified: user.emailVerified,
  };
}

export async function signInWithEmailPassword(email: string, password: string) {
  const auth = ensureFirebaseAuth();
  const result = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await result.user.getIdToken();
  return mapFirebaseUser(result.user, idToken);
}

export async function registerWithEmailPassword(payload: { email: string; password: string; fullName: string }) {
  if (!isFirebaseClientConfigured()) {
    return {
      idToken: `local:${payload.email.toLowerCase()}`,
      uid: payload.email.toLowerCase(),
      email: payload.email,
      fullName: payload.fullName,
      emailVerified: true,
    };
  }

  const auth = ensureFirebaseAuth();
  const result = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
  if (payload.fullName.trim()) {
    await updateProfile(result.user, { displayName: payload.fullName.trim() });
  }
  await sendEmailVerification(result.user);
  const idToken = await result.user.getIdToken(true);
  return mapFirebaseUser(result.user, idToken);
}

export async function signInWithGooglePopup() {
  const auth = ensureFirebaseAuth();
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();

  return mapFirebaseUser(result.user, idToken);
}

export async function sendFirebasePasswordReset(email: string) {
  const auth = ensureFirebaseAuth();
  await sendPasswordResetEmail(auth, email);
}

export async function confirmFirebasePasswordReset(code: string, password: string) {
  const auth = ensureFirebaseAuth();
  await confirmPasswordReset(auth, code, password);
}

export async function applyFirebaseEmailVerificationCode(code: string) {
  const auth = ensureFirebaseAuth();
  await applyActionCode(auth, code);
}

export async function getCurrentIdToken(forceRefresh = false) {
  if (!isFirebaseClientConfigured()) return null;
  const auth = ensureFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export function subscribeToIdTokenChanges(callback: (payload: { user: User | null; token: string | null }) => void) {
  if (!isFirebaseClientConfigured()) {
    return () => undefined;
  }

  const auth = ensureFirebaseAuth();
  return onIdTokenChanged(auth, async (user) => {
    const token = user ? await user.getIdToken() : null;
    callback({ user, token });
  });
}

export async function signOutFirebase() {
  if (!isFirebaseClientConfigured()) return;
  const auth = ensureFirebaseAuth();
  await signOut(auth);
}
