import { NextResponse } from 'next/server';
import { getUserByToken } from '@/lib/server/firestoreService';
import { getAiSettingsPublic, upsertAiSettings } from '@/lib/server/aiSettingsService';
import { isAdminRole } from '@/lib/server/apiAuth';

function parseToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type.toLowerCase() === 'bearer' ? token : null;
}

async function requireAdmin(req: Request) {
  const token = parseToken(req);
  if (!token) return null;
  const user = await getUserByToken(token);
  if (!user || !isAdminRole(user.role)) return null;
  return user;
}

export async function GET(req: Request) {
  const user = await requireAdmin(req);
  if (!user) {
    return NextResponse.json({ detail: 'Admin only' }, { status: 403 });
  }

  const settings = await getAiSettingsPublic();
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const user = await requireAdmin(req);
  if (!user) {
    return NextResponse.json({ detail: 'Admin only' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      geminiApiKey?: string | null;
      geminiModel?: string | null;
    };

    const settings = await upsertAiSettings({
      geminiApiKey: body.geminiApiKey,
      geminiModel: body.geminiModel,
      updatedBy: user.id,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('PUT /api/admin/ai-settings error:', error);
    return NextResponse.json({ detail: 'Failed to update AI settings' }, { status: 500 });
  }
}
