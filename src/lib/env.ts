import 'server-only';
import path from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  PROVIDER_MODE: z.enum(['fixture', 'live']).default('fixture'),
  YOUCAM_API_KEY: z.string().trim().optional(),
  YOUCAM_API_BASE_URL: z.url().default('https://yce-api-01.makeupar.com'),
  LIVE_DAILY_UNIT_BUDGET: z.coerce.number().int().min(0).max(10_000).default(100),
  DATA_DIR: z.string().default('./data'),
  RETENTION_HOURS: z.coerce.number().min(0.01).max(24 * 30).default(24),
  CONSULTATION_RETENTION_DAYS: z.coerce.number().min(0.01).max(365).default(30),
  APP_ACCESS_CODE: z.string().trim().optional(),
});

export type ProviderMode = 'fixture' | 'live';

export type AppEnv = {
  providerMode: ProviderMode;
  youcamApiKey: string | null;
  youcamBaseUrl: string;
  liveDailyUnitBudget: number;
  dataDir: string;
  imageRetentionMs: number;
  consultationRetentionMs: number;
  accessCode: string | null;
};

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Name the offending variables, never their values.
    const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration: ${names}`);
  }
  const e = parsed.data;
  cached = {
    providerMode: e.PROVIDER_MODE,
    youcamApiKey: e.YOUCAM_API_KEY ? e.YOUCAM_API_KEY : null,
    youcamBaseUrl: e.YOUCAM_API_BASE_URL.replace(/\/+$/, ''),
    liveDailyUnitBudget: e.LIVE_DAILY_UNIT_BUDGET,
    dataDir: path.resolve(e.DATA_DIR),
    imageRetentionMs: Math.round(e.RETENTION_HOURS * 3_600_000),
    consultationRetentionMs: Math.round(e.CONSULTATION_RETENTION_DAYS * 86_400_000),
    accessCode: e.APP_ACCESS_CODE ? e.APP_ACCESS_CODE : null,
  };
  return cached;
}

/** Test hook: forget the parsed environment so a test can change process.env. */
export function resetEnvCache(): void {
  cached = null;
}
