import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { REQUESTED_CONCERNS } from '@/lib/domain/skin';
import { normaliseSkinResults, YouCamSkinAnalysis } from '@/lib/providers/youcam/skin-analysis';
import { Fail } from '@/lib/providers/youcam/client';
import { BASE, KEY, TASK_ID, binary, fastClock, fileOk, json, mockFetch, pollSequence, taskOk, uploadOk } from '../helpers/fake-youcam';

/**
 * Contract tests. Response bodies follow the format=json example in the Skin
 * Analysis OpenAPI bundle (read 2026-10-18). They prove the adapter matches
 * the documentation, not that the live service behaves this way.
 */

const PATH = '/s2s/v2.0/task/skin-analysis';
const MASK = 'https://yce-us.s3-accelerate.amazonaws.com/results/redness_output.png?X-Amz-Signature=SECRET';
const image = { data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimeType: 'image/jpeg' as const, fileName: 'selfie.jpg' };

const success = (output: unknown[]) => ({ status: 200, data: { task_status: 'success', error: null, results: { output } } });
const docOutput = [
  { type: 'redness', region: 'whole', raw_score: 72.01, ui_score: 77, mask_urls: [MASK] },
  { type: 'moisture', region: 'whole', raw_score: 48.69, ui_score: 70, mask_urls: [] },
  { type: 'pore', region: 'whole', raw_score: 49.2, ui_score: 67, mask_urls: [] },
  { type: 'pore', region: 'nose', raw_score: 29.1, ui_score: 58, mask_urls: [] },
  { type: 'skin_type', region: 'whole', skin_type: 'Combination', mask_urls: [] },
  { type: 'skin_type', region: 't_zone', skin_type: 'Oily', mask_urls: [] },
  { type: 'skin_age', score: 29 },
  { type: 'all', score: 28.5 },
  { type: 'resize_image', mask_urls: ['https://example.com/resized.jpg'] },
];

async function png(): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: { width: 4, height: 4, channels: 4, background: '#ff000080' } }).png().toBuffer());
}

describe('YouCamSkinAnalysis', () => {
  it('runs upload → task → poll → masks, and sends the documented body', async () => {
    const { impl, calls } = mockFetch([
      fileOk,
      uploadOk,
      taskOk(PATH),
      pollSequence(PATH, { status: 200, data: { task_status: 'running', error: null, results: null } }, success(docOutput)),
      binary(MASK, await png(), 'image/png'),
    ]);
    const provider = new YouCamSkinAnalysis({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock });
    const r = await provider.analyze({ image, concerns: REQUESTED_CONCERNS });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const task = calls.find((c) => c.url === `${BASE}${PATH}` && c.method === 'POST')!;
    expect(task.body).toEqual({
      src_file_id: 'SaGaqpDgKwFrVBgMpQMA3HY0LeqdT9/13W5TOD8/u/FfjK3xgCQ+hRt9MJXBFaud',
      dst_actions: [...REQUESTED_CONCERNS],
      format: 'json',
      miniserver_args: { enable_mask_overlay: false },
    });
    expect(task.headers.Authorization).toBe(`Bearer ${KEY}`);
    // The signed mask URL is fetched without the API key.
    expect(calls.find((c) => c.url === MASK)!.headers.Authorization).toBeUndefined();

    expect(r.taskId).toBe(TASK_ID);
    expect(r.result.scores.map((s) => [s.concern, s.rawScore, s.uiScore])).toEqual([
      ['redness', 72.01, 77],
      ['moisture', 48.69, 70],
      ['pore', 49.2, 67],
    ]);
    expect(r.result.skinType).toEqual({ whole: 'Combination', t_zone: 'Oily' });
    expect(r.result.ignoredTypes).toEqual(['all', 'resize_image', 'skin_age']);
    expect(r.result.missing).toEqual(['oiliness', 'texture', 'acne', 'radiance', 'age_spot', 'wrinkle', 'firmness', 'dark_circle_v2']);
    expect(r.masks).toHaveLength(1);
    expect(r.masks[0]).toMatchObject({ concern: 'redness', mimeType: 'image/png' });
    expect(r.diagnostics).toMatchObject({ polls: 2, statusesSeen: ['running', 'success'], subRegions: 1, masksDownloaded: 1 });
    // Diagnostics never carry keys, signed URLs or scores.
    const text = JSON.stringify(r.diagnostics);
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain(KEY);
    expect(text).not.toContain('72.01');
  });

  it('keeps the score when a mask cannot be downloaded', async () => {
    const { impl } = mockFetch([fileOk, uploadOk, taskOk(PATH), pollSequence(PATH, success(docOutput)), (c) => (c.url === MASK ? new Response('no', { status: 403 }) : undefined)]);
    const r = await new YouCamSkinAnalysis({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).analyze({ image, concerns: REQUESTED_CONCERNS });
    expect(r.ok && r.result.scores[0]!.concern).toBe('redness');
    expect(r.ok && r.masks).toEqual([]);
    expect(r.diagnostics.mask_rednessFailed).toBe('download_http_403');
  });

  it('maps a documented engine error to plain guidance, uncharged and not retryable', async () => {
    const { impl } = mockFetch([
      fileOk,
      uploadOk,
      taskOk(PATH),
      pollSequence(PATH, { status: 200, data: { task_status: 'error', error: 'error_src_face_too_small', error_message: 'face too small' } }),
    ]);
    const r = await new YouCamSkinAnalysis({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).analyze({ image, concerns: REQUESTED_CONCERNS });
    expect(r).toMatchObject({ ok: false, code: 'error_src_face_too_small', retryable: false, taskId: TASK_ID });
    expect(!r.ok && r.guidance).toMatch(/60%/);
  });

  it('reports CreditInsufficiency at submit without polling', async () => {
    const { impl, calls } = mockFetch([
      fileOk,
      uploadOk,
      (c) => (c.url === `${BASE}${PATH}` ? json(400, { status: 400, error: 'no units', error_code: 'CreditInsufficiency' }) : undefined),
    ]);
    const r = await new YouCamSkinAnalysis({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).analyze({ image, concerns: REQUESTED_CONCERNS });
    expect(r).toMatchObject({ ok: false, code: 'CreditInsufficiency', retryable: false, taskId: null });
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(0);
  });

  it('retries after 429 and then succeeds', async () => {
    let first = true;
    const { impl } = mockFetch([
      (c) => {
        if (c.url === `${BASE}/s2s/v2.0/file` && first) {
          first = false;
          return json(429, { status: 429, error: 'Too many requests' });
        }
        return undefined;
      },
      fileOk,
      uploadOk,
      taskOk(PATH),
      pollSequence(PATH, success(docOutput.slice(1, 2))),
    ]);
    const r = await new YouCamSkinAnalysis({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).analyze({ image, concerns: ['moisture'] });
    expect(r.ok).toBe(true);
  });

  it('times out a task that never finishes, as retryable', async () => {
    let t = 0;
    const { impl } = mockFetch([fileOk, uploadOk, taskOk(PATH), pollSequence(PATH, { status: 200, data: { task_status: 'running', results: null } })]);
    const p = new YouCamSkinAnalysis({ apiKey: KEY, baseUrl: BASE, fetch: impl, pollIntervalMs: 1, sleep: async () => {}, taskTimeoutMs: 50, now: () => (t += 20) });
    const r = await p.analyze({ image, concerns: ['moisture'] });
    expect(r).toMatchObject({ ok: false, code: 'task_timeout', retryable: true, taskId: TASK_ID });
  });

  it('records only field shapes when the status response breaks the contract', async () => {
    const { impl } = mockFetch([fileOk, uploadOk, taskOk(PATH), pollSequence(PATH, { status: 200, data: { state: 'done', secret_value: 'abc' } })]);
    const r = await new YouCamSkinAnalysis({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).analyze({ image, concerns: ['moisture'] });
    expect(r).toMatchObject({ ok: false, code: 'unexpected_status_shape' });
    expect(JSON.stringify(r.diagnostics)).not.toContain('abc');
  });

  it('treats a network failure as retryable', async () => {
    const impl = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const r = await new YouCamSkinAnalysis({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).analyze({ image, concerns: ['moisture'] });
    expect(r).toMatchObject({ ok: false, code: 'network_error', retryable: true });
  });
});

describe('normaliseSkinResults', () => {
  const d = () => ({}) as Record<string, unknown>;

  it('keeps unknown values unknown: out-of-range or missing scores are dropped, never guessed', () => {
    const { result } = normaliseSkinResults(
      { output: [{ type: 'redness', region: 'whole', raw_score: 140 }, { type: 'moisture', region: 'whole' }, { type: 'acne', region: 'whole', raw_score: 55, ui_score: null }] },
      ['redness', 'moisture', 'acne'],
      d(),
    );
    expect(result.scores).toEqual([{ concern: 'acne', rawScore: 55, uiScore: null, maskArtifactId: null }]);
    expect(result.missing).toEqual(['redness', 'moisture']);
  });

  it('treats a missing region as whole and ignores unrequested concerns', () => {
    const { result } = normaliseSkinResults({ output: [{ type: 'texture', raw_score: 60 }, { type: 'eye_bag', raw_score: 50 }] }, ['texture'], d());
    expect(result.scores.map((s) => s.concern)).toEqual(['texture']);
    expect(result.ignoredTypes).toEqual(['eye_bag']);
  });

  it('rejects a ZIP-style result (discrepancy S1)', () => {
    expect(() => normaliseSkinResults('https://example.com/r.zip', ['texture'], d())).toThrow(Fail);
    expect(() => normaliseSkinResults({ url: 'https://example.com/r.zip' }, ['texture'], d())).toThrow(/ZIP/);
  });

  it('fails clearly when nothing usable came back', () => {
    expect(() => normaliseSkinResults({ output: [{ type: 'skin_age', score: 30 }] }, ['texture'], d())).toThrow(/no usable scores/);
  });
});
