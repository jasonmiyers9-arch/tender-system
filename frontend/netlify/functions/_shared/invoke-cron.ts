const REQUEST_TIMEOUT_MS = 55_000;

function siteUrl(): string {
  const url = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL;
  if (!url) throw new Error('URL, DEPLOY_PRIME_URL, or SITE_URL must be set');
  return url.replace(/\/$/, '');
}

export async function invokeCronRoute(path: string): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET must be configured for scheduled jobs');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${siteUrl()}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cron-secret': secret,
        'x-tenderguard-scheduler': 'netlify',
      },
      signal: controller.signal,
    });
    const body = await response.text();
    console.log(JSON.stringify({
      event: 'scheduled_job_complete',
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    }));
    return new Response(body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'scheduled_job_failed',
      path,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
