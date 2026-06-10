export const config = {
  schedule: '30 4 * * *',
};

function siteUrl(): string {
  const url = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL;
  if (!url) throw new Error('URL, DEPLOY_PRIME_URL, or SITE_URL must be set');
  return url.replace(/\/$/, '');
}

export default async function handler() {
  const response = await fetch(`${siteUrl()}/api/cron/score-snapshot`, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET || '',
    },
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
}
