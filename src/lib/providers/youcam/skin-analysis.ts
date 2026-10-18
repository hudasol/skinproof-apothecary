import {
  REQUESTED_CONCERNS,
  SCORED_CONCERNS,
  type ConcernScore,
  type RequestedConcern,
  type ScoredConcern,
  type SkinAnalysisResult,
  type SkinTypeZone,
} from '../../domain/skin';
import type { CommonRequest, MaskImage, ProviderFailure, SkinAnalysisProvider, SkinAnalysisSuccess } from '../types';
import { Fail, YouCamClient, type Diagnostics, type YouCamOptions } from './client';
import { SkinOutputItemSchema, SkinResultsSchema, shapeOf, type SkinOutputItem } from './schemas';

/**
 * YouCam AI Skin Analysis adapter (s2s v2.0, SD concerns, format=json).
 * File API → upload → POST task → poll → normalise → download masks.
 */

const PATH = '/s2s/v2.0/task/skin-analysis';
const MAX_MASK_BYTES = 15 * 1024 * 1024;
const MAX_MASKS = 16;

export class YouCamSkinAnalysis implements SkinAnalysisProvider {
  readonly mode = 'live' as const;
  readonly label = 'YouCam AI Skin Analysis (s2s v2.0, SD, json)';
  private readonly client: YouCamClient;

  constructor(opts: YouCamOptions | YouCamClient) {
    this.client = opts instanceof YouCamClient ? opts : new YouCamClient(opts);
  }

  /** The exact task body, exposed so tests and the live check can show it. */
  static taskBody(fileId: string, concerns: readonly RequestedConcern[]) {
    return { src_file_id: fileId, dst_actions: [...concerns], format: 'json', miniserver_args: { enable_mask_overlay: false } };
  }

  async analyze(req: CommonRequest & { concerns: readonly RequestedConcern[] }): Promise<SkinAnalysisSuccess | ProviderFailure> {
    const d: Diagnostics = { provider: 'youcam', endpoint: PATH, concerns: req.concerns.length };
    let taskId: string | null = null;
    const started = this.client.now();
    try {
      if (req.concerns.some((c) => !REQUESTED_CONCERNS.includes(c))) {
        throw new Fail({ code: 'unsupported_concern', message: 'An unsupported concern was requested.', guidance: null, retryable: false });
      }
      req.onPhase?.('submitting', {});
      const fileId = await this.client.uploadImage(req.image, d, req.signal);
      taskId = await this.client.startTask(PATH, YouCamSkinAnalysis.taskBody(fileId, req.concerns), d, req.signal);
      req.onPhase?.('processing', { taskId });
      const status = await this.client.pollUntilDone(PATH, taskId, d, req.signal);
      const { result, maskUrls } = normaliseSkinResults(status.data.results, req.concerns, d);
      req.onPhase?.('downloading', { taskId });
      const masks: MaskImage[] = [];
      for (const m of maskUrls.slice(0, MAX_MASKS)) {
        try {
          const file = await this.client.download(m.url, MAX_MASK_BYTES, d, `mask_${m.concern}`, req.signal);
          const mimeType = file.contentType?.includes('png') || isPng(file.data) ? 'image/png' : 'image/jpeg';
          masks.push({ concern: m.concern, data: file.data, mimeType });
        } catch (err) {
          // A missing mask is not a failed analysis: the score is still real.
          d[`mask_${m.concern}Failed`] = err instanceof Fail ? err.failure.code : 'network_error';
        }
      }
      d.masksDownloaded = masks.length;
      const latencyMs = this.client.now() - started;
      d.totalMs = latencyMs;
      return { ok: true, result, masks, taskId, latencyMs, diagnostics: d };
    } catch (err) {
      d.totalMs = this.client.now() - started;
      return this.client.toFailure(err, taskId, d, req.signal);
    }
  }
}

function isPng(b: Buffer): boolean {
  return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

const SKIN_ZONES: SkinTypeZone[] = ['whole', 't_zone', 'u_zone'];

/**
 * Turn data.results into SkinProof's domain result. Only values YouCam
 * actually returned are kept: a missing or out-of-range score stays missing.
 * Throws Fail if the results are not the documented json shape.
 */
export function normaliseSkinResults(
  raw: unknown,
  requested: readonly RequestedConcern[],
  d: Diagnostics,
): { result: SkinAnalysisResult; maskUrls: { concern: ScoredConcern; url: string }[] } {
  if (typeof raw === 'string' || (raw && typeof raw === 'object' && 'url' in raw && !('output' in raw))) {
    d.resultsShape = 'zip';
    throw new Fail({ code: 'unexpected_zip_result', message: 'The service returned a ZIP result instead of the requested JSON.', guidance: null, retryable: false });
  }
  const parsed = SkinResultsSchema.safeParse(raw);
  if (!parsed.success) {
    d.unexpectedShape = { step: 'results', shape: shapeOf(raw) };
    throw new Fail({ code: 'missing_results', message: 'The service reported success but returned no analysis.', guidance: 'Try again.', retryable: true });
  }

  const scores = new Map<ScoredConcern, ConcernScore>();
  const masks = new Map<ScoredConcern, string>();
  const skinType: SkinAnalysisResult['skinType'] = {};
  const ignored = new Set<string>();
  let invalidItems = 0;
  let subRegions = 0;
  let duplicates = 0;
  let outOfRange = 0;

  for (const rawItem of parsed.data.output) {
    const item = SkinOutputItemSchema.safeParse(rawItem);
    if (!item.success) {
      invalidItems++;
      continue;
    }
    const it: SkinOutputItem = item.data;
    const region = it.region ?? 'whole';
    if (it.type === 'skin_type') {
      if (SKIN_ZONES.includes(region as SkinTypeZone) && typeof it.skin_type === 'string' && it.skin_type.trim()) {
        skinType[region as SkinTypeZone] ??= it.skin_type.trim();
      }
      continue;
    }
    const concern = SCORED_CONCERNS.find((c) => c === it.type);
    if (!concern || !requested.includes(concern)) {
      ignored.add(it.type);
      continue;
    }
    if (region !== 'whole') {
      subRegions++;
      continue;
    }
    if (scores.has(concern)) {
      duplicates++;
      continue;
    }
    const inRange = (v: number | null | undefined) => typeof v === 'number' && v >= 0 && v <= 100;
    if (!inRange(it.raw_score)) {
      outOfRange++;
      continue;
    }
    scores.set(concern, { concern, rawScore: it.raw_score!, uiScore: inRange(it.ui_score) ? it.ui_score! : null, maskArtifactId: null });
    const url = it.mask_urls?.find((u) => typeof u === 'string' && u.startsWith('https://'));
    if (url) masks.set(concern, url);
  }

  const returned = new Set<RequestedConcern>([...scores.keys(), ...(Object.keys(skinType).length ? (['skin_type'] as const) : [])]);
  const ordered = SCORED_CONCERNS.filter((c) => scores.has(c)).map((c) => scores.get(c)!);
  Object.assign(d, { itemsReturned: parsed.data.output.length, invalidItems, subRegions, duplicates, outOfRange, scoresKept: ordered.length });
  if (ordered.length === 0 && !Object.keys(skinType).length) {
    throw new Fail({ code: 'empty_analysis', message: 'The service returned no usable scores for this photo.', guidance: 'Try another front-facing photo in even light.', retryable: false });
  }
  return {
    result: { scores: ordered, skinType, missing: requested.filter((c) => !returned.has(c)), ignoredTypes: [...ignored].sort() },
    maskUrls: [...masks.entries()].map(([concern, url]) => ({ concern, url })),
  };
}
