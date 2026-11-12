/**
 * One-time production bootstrap. Creates no HTTP route.
 * The Firebase user must already exist in Authentication.
 *
 *   BOOTSTRAP_ADMIN_EMAIL=owner@example.com \
 *   BOOTSTRAP_ADMIN_ROLE=super_admin \
 *   node scripts/bootstrap-admin.mjs
 *
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
const role = process.env.BOOTSTRAP_ADMIN_ROLE === 'admin' ? 'admin' : 'super_admin';

if (!email) {
  console.error('Set BOOTSTRAP_ADMIN_EMAIL to an existing Firebase Auth user.');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  console.error('Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const authUser = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(authUser.uid, { role });
await getFirestore().collection('users').doc(authUser.uid).set({
  id: authUser.uid,
  email,
  fullName: authUser.displayName || email.split('@')[0],
  role,
  verificationStatus: 'approved',
  isActive: true,
  createdAt: new Date().toISOString(),
}, { merge: true });

console.log(`Set ${email} (${authUser.uid}) to ${role}. Ask them to sign out and sign in again so the claim is on the ID token.`);
