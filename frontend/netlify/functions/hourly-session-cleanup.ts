import type { Config } from '@netlify/functions';
import { invokeCronRoute } from './_shared/invoke-cron';

export default async function handler() {
  return invokeCronRoute('/api/cron/cleanup-sessions');
}

export const config: Config = { schedule: '0 * * * *' };
