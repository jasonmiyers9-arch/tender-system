import type { Config } from '@netlify/functions';
import { invokeCronRoute } from './_shared/invoke-cron';

export default async function handler() {
  return invokeCronRoute('/api/cron/email-digests');
}

// 05:00 UTC = 07:00 SAST.
export const config: Config = { schedule: '0 5 * * *' };
