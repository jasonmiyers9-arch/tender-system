function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function sendAuthEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || 'TenderGuard Pro';

  if (!apiKey || !fromEmail) {
    return { sent: false, reason: 'SendGrid is not configured' };
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: fromEmail, name: fromName },
      subject: input.subject,
      content: [{ type: 'text/plain', value: input.body }],
    }),
  });

  if (!response.ok) {
    return { sent: false, reason: `SendGrid returned ${response.status}` };
  }

  return { sent: true };
}

export function passwordResetEmailBody(resetLink: string): string {
  return [
    'We received a request to reset your TenderGuard Pro password.',
    '',
    `Reset your password: ${resetLink}`,
    '',
    'If you did not request this, you can ignore this email.',
    '',
    `Open TenderGuard: ${appUrl()}`,
  ].join('\n');
}

export function emailVerificationBody(verifyLink: string): string {
  return [
    'Welcome to TenderGuard Pro.',
    '',
    `Verify your email address: ${verifyLink}`,
    '',
    'This link confirms that you can receive account and compliance notifications.',
    '',
    `Open TenderGuard: ${appUrl()}`,
  ].join('\n');
}
