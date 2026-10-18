import { describe, expect, it } from 'vitest';
import { buildLipEffects } from '@/lib/domain/tryon';
import { YouCamMakeup } from '@/lib/providers/youcam/makeup-vto';
import { BASE, KEY, TASK_ID, binary, fastClock, fileOk, mockFetch, pollSequence, taskOk, uploadOk } from '../helpers/fake-youcam';

const PATH = '/s2s/v2.0/task/makeup-vto';
const RESULT = 'https://yce-us.s3-accelerate.amazonaws.com/demo/ttl30/out.png?X-Amz-Signature=SECRET';
const image = { data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), mimeType: 'image/jpeg' as const, fileName: 'selfie.jpg' };

describe('buildLipEffects', () => {
  it('always turns the default skin smoothing off and uses the live-verified gloss texture', () => {
    const e = buildLipEffects('#c8524e');
    expect(e.effects[0]).toEqual({ category: 'skin_smooth', skinSmoothStrength: 0, skinSmoothColorIntensity: 0 });
    expect(e.effects[1]).toMatchObject({ category: 'lip_color', style: { type: 'full' }, palettes: [{ color: '#C8524E', texture: 'gloss' }] });
  });
  it('rejects anything but a hex colour', () => {
    expect(() => buildLipEffects('red')).toThrow();
  });
});

describe('YouCamMakeup', () => {
  it('runs the documented chain, tolerating running-state nulls (seen live by TryOn)', async () => {
    const { impl, calls } = mockFetch([
      fileOk,
      uploadOk,
      taskOk(PATH),
      pollSequence(
        PATH,
        { status: 200, data: { error: null, results: null, task_status: 'running' } },
        { status: 200, data: { error: null, results: { url: RESULT }, task_status: 'success' } },
      ),
      binary(RESULT, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'binary/octet-stream'),
    ]);
    const effects = buildLipEffects('#8E3144');
    const r = await new YouCamMakeup({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).render({ image, effects });
    expect(r).toMatchObject({ ok: true, taskId: TASK_ID });
    const task = calls.find((c) => c.url === `${BASE}${PATH}` && c.method === 'POST')!;
    expect(task.body).toEqual({ src_file_id: 'SaGaqpDgKwFrVBgMpQMA3HY0LeqdT9/13W5TOD8/u/FfjK3xgCQ+hRt9MJXBFaud', ...effects });
    expect(r.diagnostics.resultShape).toBe('object_url');
    expect(JSON.stringify(r.diagnostics)).not.toContain('SECRET');
  });

  it('accepts the prose result shape [{ download_url }] (discrepancy D1)', async () => {
    const { impl } = mockFetch([
      fileOk,
      uploadOk,
      taskOk(PATH),
      pollSequence(PATH, { status: 200, data: { task_status: 'success', results: [{ download_url: RESULT }] } }),
      binary(RESULT, new Uint8Array([1, 2, 3]), 'image/png'),
    ]);
    const r = await new YouCamMakeup({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).render({ image, effects: buildLipEffects('#8E3144') });
    expect(r.ok && r.diagnostics.resultShape).toBe('array_download_url');
  });

  it('fails clearly when success carries no result URL', async () => {
    const { impl } = mockFetch([fileOk, uploadOk, taskOk(PATH), pollSequence(PATH, { status: 200, data: { task_status: 'success', results: {} } })]);
    const r = await new YouCamMakeup({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).render({ image, effects: buildLipEffects('#8E3144') });
    expect(r).toMatchObject({ ok: false, code: 'missing_result_url', retryable: true });
  });

  it('refuses a non-https result address', async () => {
    const { impl } = mockFetch([fileOk, uploadOk, taskOk(PATH), pollSequence(PATH, { status: 200, data: { task_status: 'success', results: { url: 'http://insecure.example.com/x.png' } } })]);
    const r = await new YouCamMakeup({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).render({ image, effects: buildLipEffects('#8E3144') });
    expect(r).toMatchObject({ ok: false, code: 'result_url_not_https' });
  });

  it('reports a failed upload with its status', async () => {
    const { impl } = mockFetch([fileOk, (c) => (c.url.startsWith('https://upload.example.com') ? new Response(null, { status: 403 }) : undefined)]);
    const r = await new YouCamMakeup({ apiKey: KEY, baseUrl: BASE, fetch: impl, ...fastClock }).render({ image, effects: buildLipEffects('#8E3144') });
    expect(r).toMatchObject({ ok: false, code: 'upload_http_403', retryable: false });
  });
});
