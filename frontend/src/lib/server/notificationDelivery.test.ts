import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendTenderMatchDigest } from './notificationDelivery';
import type { NotificationRecord } from './firestoreService';

function matchNotification(id: string, title: string): NotificationRecord {
  return {
    id,
    companyId: 'company-1',
    userId: 'user-1',
    alertType: 'info',
    title,
    message: `${title} is a 90% match.`,
    isRead: false,
    triggerDate: '2026-06-21T04:00:00.000Z',
    createdAt: '2026-06-21T04:00:00.000Z',
    dedupeKey: `tender-match:${id}:company-1:user:user-1`,
    actionUrl: `/tenders/${id}`,
  };
}

describe('sendTenderMatchDigest', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends one email containing every match and direct application links', async () => {
    vi.stubEnv('SENDGRID_API_KEY', 'test-key');
    vi.stubEnv('SENDGRID_FROM_EMAIL', 'info@tenderguardpro.co.za');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://tender-guard-pro.netlify.app');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendTenderMatchDigest('company@example.com', [
      matchNotification('tender-1', 'Tender One'),
      matchNotification('tender-2', 'Tender Two'),
    ]);

    expect(result.status).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    const content = body.content[0].value as string;
    expect(body.subject).toBe('2 new tender matches for your company');
    expect(content).toContain('Tender One');
    expect(content).toContain('Tender Two');
    expect(content).toContain('https://tender-guard-pro.netlify.app/tenders/tender-1');
    expect(content).toContain('https://tender-guard-pro.netlify.app/tenders/tender-2');
    expect(body.tracking_settings.click_tracking).toEqual({ enable: false, enable_text: false });
  });
});
