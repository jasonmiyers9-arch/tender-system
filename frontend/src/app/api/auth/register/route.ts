import { NextResponse } from 'next/server';
import { createUser } from '@/lib/server/firestoreService';

export async function POST(req: Request) {
  const data = await req.json();
  const name = String(data.name ?? '').trim();
  const email = String(data.email ?? '').trim().toLowerCase();
  const password = String(data.password ?? '');
  const role = String(data.role ?? 'company');
  const companyName = data.company_name ? String(data.company_name).trim() : undefined;
  const registrationNumber = data.registration_number ? String(data.registration_number).trim() : undefined;
  const phone = data.phone ? String(data.phone).trim() : undefined;

  if (!name || !email || !password) {
    return NextResponse.json({ detail: 'Name, email and password are required' }, { status: 400 });
  }

  try {
    const user = await createUser({ name, email, password, role, companyName, registrationNumber, phone });
    return NextResponse.json({
      status: 'pending',
      message: 'Account created. Please verify your email.',
      verifyLink: null,
      user,
    });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : 'Registration failed' }, { status: 400 });
  }
}
