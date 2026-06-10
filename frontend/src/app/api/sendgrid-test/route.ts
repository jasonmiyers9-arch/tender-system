import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export async function GET() {
  try {
    await sgMail.send({
      to: 'your-email@example.com',
      from: 'no-reply@tenderguardpro.co.za',
      subject: 'SendGrid test',
      text: 'This is a test from TenderGuard Pro',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
