import type { Config } from '@netlify/functions';
import { invokeCronRoute } from './_shared/invoke-cron';

export default async function handler() {
  return invokeCronRoute('/api/cron/email-digests');
}

// Monday and Thursday at 06:00 SAST (04:00 UTC).
export const config: Config = { schedule: '0 4 * * 1,4' };
