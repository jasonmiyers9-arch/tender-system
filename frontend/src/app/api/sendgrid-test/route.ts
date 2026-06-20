import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || 'Tender Guard Pro';
  const toEmail = searchParams.get('to') || process.env.SENDGRID_TEST_TO_EMAIL;
  const subject = searchParams.get('subject') || 'Tender Guard Pro SendGrid test';

  if (!apiKey || !fromEmail || !toEmail) {
    return NextResponse.json(
      {
        ok: false,
        error: 'SendGrid is not configured. Set SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, and SENDGRID_TEST_TO_EMAIL.',
      },
      { status: 500 },
    );
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: 'text/plain', value: 'This is a test from Tender Guard Pro.' }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `SendGrid returned ${response.status}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
