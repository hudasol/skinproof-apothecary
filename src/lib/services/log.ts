/**
 * Structured one-line JSON logs. Callers pass identifiers and codes only:
 * never API keys, signed URLs, image bytes, scores or user choices.
 */
export function log(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.SKINPROOF_LOG === 'silent') return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
