const FIREBASE_AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1/accounts';

function apiKey(): string {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) {
    throw new Error('Firebase API key is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY.');
  }
  return key;
}

async function postFirebaseAction<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${FIREBASE_AUTH_BASE}:${path}?key=${apiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof json?.error?.message === 'string' ? json.error.message : 'Firebase action failed';
    throw new Error(message);
  }

  return json as T;
}

export async function applyEmailVerificationCode(oobCode: string): Promise<{ email?: string }> {
  return postFirebaseAction('update', { oobCode });
}

export async function verifyPasswordResetCode(oobCode: string): Promise<{ email: string }> {
  return postFirebaseAction('resetPassword', { oobCode });
}

export async function confirmPasswordResetCode(oobCode: string, newPassword: string): Promise<{ email: string }> {
  return postFirebaseAction('resetPassword', { oobCode, newPassword });
}
