/** Runs once when the server starts: recover jobs cut off by a restart, then enforce retention. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { getDb } = await import('./lib/db/client');
  const { recoverInterruptedAnalyses } = await import('./lib/services/analyses');
  const { recoverInterruptedPreviews } = await import('./lib/services/previews');
  const { purgeExpired } = await import('./lib/services/consultations');
  const { log } = await import('./lib/services/log');
  const db = getDb();
  const a = recoverInterruptedAnalyses(db);
  const p = recoverInterruptedPreviews(db);
  if (a || p) log('warn', 'jobs.interrupted', { analyses: a, previews: p });
  const sweep = () => purgeExpired(db).catch((err) => log('error', 'retention.failed', { error: err instanceof Error ? err.message : String(err) }));
  await sweep();
  // Retention runs every 15 minutes while the server is up.
  setInterval(sweep, 15 * 60 * 1000).unref();
}
