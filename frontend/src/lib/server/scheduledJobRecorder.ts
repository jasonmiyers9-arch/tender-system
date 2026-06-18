import { recordScheduledJobRun } from './firestoreService';

export async function runRecordedJob<T extends { job: string; ok: boolean; checkedAt?: string; errors?: string[] }>(
  job: string,
  runner: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await runner();
    await recordScheduledJobRun({ ...result, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordScheduledJobRun({
      job,
      ok: false,
      checkedAt: new Date().toISOString(),
      errors: [message],
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
