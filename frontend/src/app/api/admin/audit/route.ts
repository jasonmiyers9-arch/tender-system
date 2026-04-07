import { NextRequest, NextResponse } from 'next/server';
import { getUserByToken } from '@/lib/server/firestoreService';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

// In-memory audit log — seeded with sample entries for demo purposes.
// A real implementation would persist these to Firestore / a database.
const SEED_ENTRIES = [
  { id: 'aud-1', actor: 'Mouse', action: 'Verified document', entity: 'document', entityId: 'doc-1', timestamp: '2026-03-11T14:22:00Z', metadata: { documentName: 'Tax Clearance Certificate 2025' } },
  { id: 'aud-2', actor: 'Mouse', action: 'Verified document', entity: 'document', entityId: 'doc-2', timestamp: '2026-03-11T14:25:00Z', metadata: { documentName: 'CIPC Registration' } },
  { id: 'aud-3', actor: 'System', action: 'Company registered', entity: 'company', entityId: 'demo-company', timestamp: '2026-03-10T08:00:00Z', metadata: { companyName: 'Demo Compliance Holdings' } },
  { id: 'aud-4', actor: 'Tender Demo User', action: 'Uploaded document', entity: 'document', entityId: 'doc-1', timestamp: '2026-03-10T09:00:00Z', metadata: { documentName: 'Tax Clearance Certificate 2025' } },
  { id: 'aud-5', actor: 'Tender Demo User', action: 'Uploaded document', entity: 'document', entityId: 'doc-2', timestamp: '2026-03-10T09:15:00Z', metadata: { documentName: 'CIPC Registration' } },
  { id: 'aud-6', actor: 'Tender Demo User', action: 'Submitted application', entity: 'application', entityId: 'app-1', timestamp: '2026-03-15T10:30:00Z', metadata: { tenderTitle: 'Municipal IT Support Services' } },
  { id: 'aud-7', actor: 'System', action: 'User created', entity: 'user', entityId: 'demo-user', timestamp: '2026-03-09T12:00:00Z', metadata: {} },
  { id: 'aud-8', actor: 'Mouse', action: 'Logged in', entity: 'session', entityId: 'demo-admin', timestamp: '2026-04-07T08:00:00Z', metadata: {} },
];

export async function GET(req: NextRequest) {
  const token = parseToken(req);
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await getUserByToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
    }

    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(req.nextUrl.searchParams.get('page_size') ?? '20', 10);

    // Sort newest first
    const sorted = [...SEED_ENTRIES].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const start = (page - 1) * pageSize;
    const entries = sorted.slice(start, start + pageSize);

    return NextResponse.json({ entries, total: sorted.length });
  } catch (error) {
    console.error('GET /api/admin/audit error:', error);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
