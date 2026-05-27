import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/apiAuth';
import { getCompanyById, updateCompanyProfile } from '@/lib/server/firestoreService';
import type { Company } from '@/lib/api/types';

const EDITABLE_FIELDS = [
  'name',
  'registrationNumber',
  'vatNumber',
  'address',
  'phone',
  'email',
  'website',
  'industry',
  'status',
  'province',
  'bbbeeLevel',
  'cidbGrade',
  'csdNumber',
] as const;

type EditableKey = (typeof EDITABLE_FIELDS)[number];

const STATUS_VALUES = new Set(['verified', 'pending', 'rejected']);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ detail: 'Company not found' }, { status: 404 });
  }
  return NextResponse.json(company);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { companyId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  const payload: Partial<Company> = {};
  for (const key of EDITABLE_FIELDS) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (key === 'status') {
      if (typeof raw !== 'string' || !STATUS_VALUES.has(raw)) {
        return NextResponse.json(
          { detail: `Invalid status. Expected one of: ${[...STATUS_VALUES].join(', ')}` },
          { status: 400 },
        );
      }
      payload.status = raw as Company['status'];
    } else if (raw === null || typeof raw === 'string') {
      (payload as Record<EditableKey, unknown>)[key] = raw;
    }
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ detail: 'No editable fields supplied' }, { status: 400 });
  }

  try {
    const company = await updateCompanyProfile(companyId, payload);
    return NextResponse.json(company);
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Failed to update company' },
      { status: 400 },
    );
  }
}
