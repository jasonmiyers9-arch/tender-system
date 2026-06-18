import type { Config } from '@netlify/functions';
import { invokeCronRoute } from './_shared/invoke-cron';

export default async function handler() {
  return invokeCronRoute('/api/cron/scrape');
}

// Netlify schedules are UTC. 03:00 UTC = 05:00 SAST.
export const config: Config = { schedule: '0 3 * * *' };
