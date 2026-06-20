import { invokeCronRoute } from './_shared/invoke-cron';

export default async function handler() {
  return invokeCronRoute('/api/cron/email-digests');
}
