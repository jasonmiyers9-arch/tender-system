import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { createUser, listAllUsers } from '@/lib/server/firestoreService';
import { createEmailPasswordUser, deleteAuthUser, isFirestoreAvailable } from '@/lib/server/firebaseAdmin';

export async function GET(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const items = (await listAllUsers())
    .filter((u) => u.role === 'admin')
    .map((u) => ({
      id: u.id,
      name: u.fullName || u.email.split('@')[0],
      email: u.email,
      role: u.role,
      verificationStatus: u.verificationStatus,
      createdAt: u.createdAt,
    }));

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json();
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '').trim();

  if (!name || !email || !password) {
    return NextResponse.json({ detail: 'Name, email, and password are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ detail: 'Password must be at least 8 characters long' }, { status: 400 });
  }

  if (!isFirestoreAvailable()) {
    return NextResponse.json(
      { detail: 'Firebase Admin provisioning is not configured in this environment' },
      { status: 503 }
    );
  }

  let authUserUid: string | null = null;

  try {
    const authUser = await createEmailPasswordUser({
      email,
      password,
      displayName: name,
    });
    authUserUid = authUser.uid;

    const user = await createUser({
      uid: authUser.uid,
      name,
      email,
      role: 'admin',
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (authUserUid) {
      try {
        await deleteAuthUser(authUserUid);
      } catch {
        // Best-effort cleanup to avoid leaving a half-provisioned auth user behind.
      }
    }

    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Unable to create internal admin account' },
      { status: 400 }
    );
  }
}
