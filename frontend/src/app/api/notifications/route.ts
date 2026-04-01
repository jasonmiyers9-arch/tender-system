import { NextResponse } from 'next/server';

const notifications = [
  {
    id: 'notif-1',
    alertType: 'info',
    title: 'Document review complete',
    message: 'Your latest tax document has been verified.',
    isRead: false,
    triggerDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'notif-2',
    alertType: 'warning',
    title: 'Tender deadline approaching',
    message: 'The Municipal IT Support Services deadline is in 5 days.',
    isRead: false,
    triggerDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const unreadOnly = params.get('unread_only') === 'true';
  const limit = Number(params.get('limit') ?? notifications.length);
  const items = notifications.filter((item) => (!unreadOnly || !item.isRead)).slice(0, limit);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path.endsWith('/mark-all-read')) {
    return NextResponse.json({ ok: true, count: notifications.length });
  }

  const match = path.match(/\/notifications\/(.+)\/read$/);
  if (match) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ detail: 'Not found' }, { status: 404 });
}
