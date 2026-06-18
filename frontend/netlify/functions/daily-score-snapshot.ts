import type { Config } from '@netlify/functions';
import { invokeCronRoute } from './_shared/invoke-cron';

export default async function handler() {
  return invokeCronRoute('/api/cron/score-snapshot');
}

export const config: Config = { schedule: '59 21 * * *' };
