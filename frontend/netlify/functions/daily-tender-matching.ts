import type { Config } from '@netlify/functions';
import { invokeCronRoute } from './_shared/invoke-cron';

export default async function handler() {
  return invokeCronRoute('/api/cron/match-tenders');
}

// Runs after ingestion has completed.
export const config: Config = { schedule: '30 3 * * *' };
