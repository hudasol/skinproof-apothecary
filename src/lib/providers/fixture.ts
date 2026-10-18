import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { SCORED_CONCERNS, SKIN_TYPES, type RequestedConcern, type SkinAnalysisResult } from '../domain/skin';
import type { MakeupTaskEffects } from '../domain/tryon';
import type { CommonRequest, MakeupProvider, MakeupSuccess, ProviderFailure, SkinAnalysisProvider, SkinAnalysisSuccess } from './types';

/**
 * Offline providers for development, tests and demos without a key. They are
 * NOT YouCam: every result they produce is stored and shown as "fixture".
 *
 * - Skin analysis: scores are derived from the photo's SHA-256, so the same
 *   photo always gives the same scores and different photos differ. They mean
 *   nothing about the skin. No masks are produced.
 * - A very dark photo (mean brightness under 40/255) returns the documented
 *   engine error `error_lighting_dark`, so the failure path can be exercised.
 * - Makeup: tints a fixed ellipse in the lower centre and stamps
 *   "FIXTURE · not a YouCam result" on the image.
 */

async function pause(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });
  });
}

async function meanBrightness(data: Buffer): Promise<number> {
  const stats = await sharp(data).greyscale().stats();
  return stats.channels[0]?.mean ?? 0;
}

function simulatedFailure(code: string, message: string, guidance: string, d: Record<string, unknown>): ProviderFailure {
  return { ok: false, code, message: `${message} (Simulated by the fixture provider.)`, guidance, retryable: false, taskId: null, diagnostics: d };
}

export class FixtureSkinAnalysis implements SkinAnalysisProvider {
  readonly mode = 'fixture' as const;
  readonly label = 'SkinProof fixture analysis (not YouCam)';
  constructor(private readonly delayMs = 0) {}

  async analyze(req: CommonRequest & { concerns: readonly RequestedConcern[] }): Promise<SkinAnalysisSuccess | ProviderFailure> {
    const started = Date.now();
    const d: Record<string, unknown> = { provider: 'fixture' };
    req.onPhase?.('submitting', {});
    await pause(this.delayMs, req.signal);
    req.onPhase?.('processing', {});
    await pause(this.delayMs, req.signal);
    if ((await meanBrightness(req.image.data)) < 40) {
      return simulatedFailure('error_lighting_dark', 'The photo is too dark to analyse.', 'Face a window or a soft light and try again.', d);
    }
    const digest = createHash('sha256').update(req.image.data).digest();
    const scores = SCORED_CONCERNS.filter((c) => req.concerns.includes(c)).map((concern, i) => {
      const rawScore = 30 + (digest[i]! % 60) + (digest[i + 12]! % 10) / 10;
      return { concern, rawScore, uiScore: Math.min(99, Math.round(rawScore + 12)), maskArtifactId: null };
    });
    const result: SkinAnalysisResult = {
      scores,
      skinType: req.concerns.includes('skin_type') ? { whole: SKIN_TYPES[digest[30]! % 4]! } : {},
      missing: [],
      ignoredTypes: [],
    };
    req.onPhase?.('downloading', {});
    return { ok: true, result, masks: [], taskId: null, latencyMs: Date.now() - started, diagnostics: d };
  }
}

export class FixtureMakeup implements MakeupProvider {
  readonly mode = 'fixture' as const;
  readonly label = 'SkinProof fixture try-on (not YouCam)';
  constructor(private readonly delayMs = 0) {}

  async render(req: CommonRequest & { effects: MakeupTaskEffects }): Promise<MakeupSuccess | ProviderFailure> {
    const started = Date.now();
    const d: Record<string, unknown> = { provider: 'fixture' };
    req.onPhase?.('submitting', {});
    await pause(this.delayMs, req.signal);
    req.onPhase?.('processing', {});
    await pause(this.delayMs, req.signal);
    if ((await meanBrightness(req.image.data)) < 40) {
      return simulatedFailure('error_face_position_invalid', 'The whole face must be visible.', 'Use a front-facing photo in even light.', d);
    }
    const lip = req.effects.effects.find((e) => e.category === 'lip_color');
    const palette = lip && 'palettes' in lip ? lip.palettes[0] : undefined;
    const meta = await sharp(req.image.data).metadata();
    const w = meta.width!;
    const h = meta.height!;
    const opacity = (((palette?.colorIntensity ?? 50) / 100) * 0.6).toFixed(3);
    const font = Math.max(12, Math.round(Math.min(w, h) * 0.032));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <ellipse cx="${Math.round(w * 0.5)}" cy="${Math.round(h * 0.7)}" rx="${Math.round(w * 0.12)}" ry="${Math.round(h * 0.04)}" fill="${palette?.color ?? '#A8323E'}" fill-opacity="${opacity}"/>
      <text x="${font * 0.7}" y="${h - font * 0.8}" font-family="Arial, sans-serif" font-size="${font}" font-weight="700" fill="#FFFFFF" stroke="#1E1B1A" stroke-width="${Math.max(2, font * 0.16)}" paint-order="stroke">FIXTURE · not a YouCam result</text>
    </svg>`;
    const output = await sharp(req.image.data).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 92 }).toBuffer();
    req.onPhase?.('downloading', {});
    return { ok: true, output, taskId: null, latencyMs: Date.now() - started, diagnostics: d };
  }
}
