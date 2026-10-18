import 'server-only';
import { getEnv } from '../env';
import { FixtureMakeup, FixtureSkinAnalysis } from './fixture';
import type { MakeupProvider, SkinAnalysisProvider } from './types';
import { YouCamClient } from './youcam/client';
import { YouCamMakeup } from './youcam/makeup-vto';
import { YouCamSkinAnalysis } from './youcam/skin-analysis';

export type ProviderState =
  | { mode: 'fixture'; ready: true }
  | { mode: 'live'; ready: true }
  | { mode: 'live'; ready: false; problem: string };

export function providerState(): ProviderState {
  const env = getEnv();
  if (env.providerMode === 'fixture') return { mode: 'fixture', ready: true };
  if (!env.youcamApiKey) return { mode: 'live', ready: false, problem: 'PROVIDER_MODE is live but YOUCAM_API_KEY is not set.' };
  return { mode: 'live', ready: true };
}

function fixtureDelay(): number {
  const n = Number(process.env.FIXTURE_DELAY_MS ?? '600');
  return Number.isFinite(n) ? n : 0;
}

function client(): YouCamClient | null {
  const env = getEnv();
  return env.youcamApiKey ? new YouCamClient({ apiKey: env.youcamApiKey, baseUrl: env.youcamBaseUrl }) : null;
}

/** The provider for new analyses, or null when live mode has no key. */
export function skinAnalysisProvider(): SkinAnalysisProvider | null {
  if (getEnv().providerMode === 'fixture') return new FixtureSkinAnalysis(fixtureDelay());
  const c = client();
  return c ? new YouCamSkinAnalysis(c) : null;
}

export function makeupProvider(): MakeupProvider | null {
  if (getEnv().providerMode === 'fixture') return new FixtureMakeup(fixtureDelay());
  const c = client();
  return c ? new YouCamMakeup(c) : null;
}

/** For the credit balance on the system page (free endpoint). */
export function youcamClient(): YouCamClient | null {
  return client();
}
