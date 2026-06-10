import type { InternalUser } from './mockData';
import type { NotificationRecord } from './firestoreService';

export interface DeliveryResult {
  channel: 'email' | 'sms';
  recipient: string;
  status: 'sent' | 'skipped' | 'failed';
  reason?: string;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function sendEmail(to: string, notification: NotificationRecord): Promise<DeliveryResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || 'TenderGuard Pro';

  if (!apiKey || !fromEmail) {
    return { channel: 'email', recipient: to, status: 'skipped', reason: 'SendGrid is not configured' };
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject: notification.title,
      content: [
        {
          type: 'text/plain',
          value: `${notification.message}\n\nOpen TenderGuard: ${appUrl()}/notifications`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return { channel: 'email', recipient: to, status: 'failed', reason: `SendGrid returned ${response.status}` };
  }

  return { channel: 'email', recipient: to, status: 'sent' };
}

async function sendSms(to: string, notification: NotificationRecord): Promise<DeliveryResult> {
  const apiKey = process.env.CLICKATELL_API_KEY;
  const from = process.env.CLICKATELL_FROM;

  if (!apiKey) {
    return { channel: 'sms', recipient: to, status: 'skipped', reason: 'Clickatell is not configured' };
  }

  const content = `${notification.title}: ${notification.message}`;
  const response = await fetch('https://platform.clickatell.com/messages/http/send', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      content: content.length > 459 ? `${content.slice(0, 456)}...` : content,
      to: [to],
      ...(from ? { from } : {}),
    }),
  });

  if (!response.ok) {
    return { channel: 'sms', recipient: to, status: 'failed', reason: `Clickatell returned ${response.status}` };
  }

  return { channel: 'sms', recipient: to, status: 'sent' };
}

export async function sendNotificationDeliveries(
  notification: NotificationRecord,
  recipient: InternalUser
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  if (recipient.email) {
    try {
      results.push(await sendEmail(recipient.email, notification));
    } catch (err) {
      results.push({
        channel: 'email',
        recipient: recipient.email,
        status: 'failed',
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (recipient.phone) {
    try {
      results.push(await sendSms(recipient.phone, notification));
    } catch (err) {
      results.push({
        channel: 'sms',
        recipient: recipient.phone,
        status: 'failed',
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
