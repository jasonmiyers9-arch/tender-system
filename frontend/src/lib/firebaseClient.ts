import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!getApps().length) {
  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
    throw new Error('Firebase client configuration is missing. Set NEXT_PUBLIC_FIREBASE_* environment variables.');
  }

  initializeApp(firebaseConfig);
}

const auth = getAuth();
const googleProvider = new GoogleAuthProvider();

export async function signInWithGooglePopup() {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();

  return {
    idToken,
    uid: result.user.uid,
    email: result.user.email,
    fullName: result.user.displayName || '',
  };
}
