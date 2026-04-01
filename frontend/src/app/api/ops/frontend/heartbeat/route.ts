import { NextResponse } from 'next/server';
import { recordHeartbeat } from '../monitorStore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const route = typeof body.route === 'string' ? body.route : null;
    const userAgent = typeof body.user_agent === 'string' ? body.user_agent : null;
    recordHeartbeat({ route, user_agent: userAgent });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ detail: 'Invalid heartbeat payload' }, { status: 400 });
  }
}
