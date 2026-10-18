/**
 * Explicit live checks of SkinProof's YouCam adapters. Nothing that costs
 * units runs without --spend.
 *
 *   npm run verify:live -- credits
 *       Free: reads the account's unit balance.
 *   npm run verify:live -- skin  --image <file> | --image-url <url>  [--crop x,y,w,h] --spend
 *       One Skin Analysis task, 12 SD concerns: 14 units if it succeeds, 0 if rejected.
 *   npm run verify:live -- tryon --image <file> | --image-url <url>  [--crop x,y,w,h] [--shade product/shade] --spend
 *       One lip_color makeup task with skin smoothing at 0: 1 unit if it succeeds.
 *
 * Without --spend, the script prints exactly what it would send and stops.
 * Reads YOUCAM_API_KEY from the environment or .env.local; never prints it.
 * Writes docs/live-checks/<timestamp>-<check>.json (no key, no signed URLs).
 * Output images are written only with --keep-output, to git-ignored names.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getProduct } from '../src/lib/catalogue';
import { sha256Hex } from '../src/lib/domain/canonical';
import { MAKEUP_PREVIEW_UNITS, REQUESTED_CONCERNS, SKIN_ANALYSIS_UNITS } from '../src/lib/domain/skin';
import { buildLipEffects } from '../src/lib/domain/tryon';
import { fitForPreview, inspectOutput, normalisePhoto, type Crop } from '../src/lib/images/normalize';
import { YouCamClient } from '../src/lib/providers/youcam/client';
import { YouCamMakeup } from '../src/lib/providers/youcam/makeup-vto';
import { YouCamSkinAnalysis } from '../src/lib/providers/youcam/skin-analysis';

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function loadImage(): Promise<{ bytes: Uint8Array; source: string }> {
  const file = arg('--image');
  const url = arg('--image-url');
  if (file) return { bytes: fs.readFileSync(file), source: `file ${path.basename(file)}` };
  if (url) {
    if (!url.startsWith('https://')) throw new Error('--image-url must be https');
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Could not fetch the image (HTTP ${res.status})`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), source: url };
  }
  throw new Error('Pass --image <file> or --image-url <https url> for a portrait you have the right to use.');
}

function parseCrop(): Crop | null {
  const raw = arg('--crop');
  if (!raw) return null;
  const [x, y, width, height] = raw.split(',').map(Number);
  return { x: x!, y: y!, width: width!, height: height! };
}

async function main() {
  loadEnvFile('.env.local');
  const check = process.argv[2];
  const spend = process.argv.includes('--spend');
  if (!check || !['credits', 'skin', 'tryon'].includes(check)) throw new Error('First argument: credits | skin | tryon');
  const key = process.env.YOUCAM_API_KEY?.trim();
  if (!key) throw new Error('YOUCAM_API_KEY is not set (put it in .env.local).');
  const baseUrl = (process.env.YOUCAM_API_BASE_URL ?? 'https://yce-api-01.makeupar.com').replace(/\/+$/, '');
  const client = new YouCamClient({ apiKey: key, baseUrl });

  const balance = async () => {
    try {
      return (await client.getCredits()).total;
    } catch (err) {
      console.warn('Could not read the unit balance:', err instanceof Error ? err.message : err);
      return null;
    }
  };

  if (check === 'credits') {
    console.log(`Unit balance: ${await balance()}`);
    return;
  }

  const { bytes, source } = await loadImage();
  const crop = parseCrop();
  const photo = await normalisePhoto(bytes, crop);
  const record: Record<string, unknown> = {
    check,
    checkedAt: new Date().toISOString(),
    baseUrl,
    input: { source, crop, normalised: { width: photo.width, height: photo.height, sha256: sha256Hex(photo.data) } },
  };

  let plan: string;
  let shadeHex: string | null = null;
  if (check === 'skin') {
    plan = `POST /s2s/v2.0/file + PUT upload + POST /s2s/v2.0/task/skin-analysis (${REQUESTED_CONCERNS.length} SD concerns, json) + polls + mask downloads. Expected cost: ${SKIN_ANALYSIS_UNITS} units if it succeeds, 0 if rejected.`;
    record.request = { endpoint: '/s2s/v2.0/task/skin-analysis', body: YouCamSkinAnalysis.taskBody('<file id>', REQUESTED_CONCERNS) };
  } else {
    const [productId, shadeId] = (arg('--shade') ?? 'hurraw-tinted-lip-balm/black-cherry').split('/');
    const shade = getProduct(productId!)?.shades.find((s) => s.id === shadeId);
    if (!shade?.render) throw new Error(`No measured colour for ${productId}/${shadeId}`);
    shadeHex = shade.render.hex;
    plan = `POST /s2s/v2.0/file + PUT upload + POST /s2s/v2.0/task/makeup-vto (lip_color ${shadeHex}, skin smoothing 0) + polls + one download. Expected cost: ${MAKEUP_PREVIEW_UNITS} unit if it succeeds.`;
    record.request = { endpoint: '/s2s/v2.0/task/makeup-vto', shade: `${productId}/${shadeId}`, effects: buildLipEffects(shadeHex) };
  }
  console.log(`Input: ${source}, normalised to ${photo.width} x ${photo.height}${crop ? ` (crop ${JSON.stringify(crop)})` : ''}.`);
  console.log(`Plan: ${plan}`);
  if (!spend) {
    console.log('Dry run: nothing was sent. Add --spend to run it.');
    return;
  }

  const before = await balance();
  const keep = process.argv.includes('--keep-output');
  const dir = path.join(process.cwd(), 'docs', 'live-checks');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (check === 'skin') {
    const res = await new YouCamSkinAnalysis(client).analyze({
      image: { data: photo.data, mimeType: 'image/jpeg', fileName: 'live-check.jpg' },
      concerns: REQUESTED_CONCERNS,
      onPhase: (p) => console.log(`  ${p}…`),
    });
    record.outcome = res.ok
      ? { ok: true, latencyMs: res.latencyMs, taskIdPrefix: res.taskId?.slice(0, 8), result: res.result, masks: res.masks.map((m) => ({ concern: m.concern, mimeType: m.mimeType, bytes: m.data.byteLength })) }
      : { ok: false, code: res.code, message: res.message, retryable: res.retryable, taskIdPrefix: res.taskId?.slice(0, 8) };
    record.diagnostics = res.diagnostics;
    if (res.ok && keep) for (const m of res.masks) fs.writeFileSync(path.join(dir, `${stamp}-mask-${m.concern}.${m.mimeType === 'image/png' ? 'png' : 'jpg'}`), m.data);
  } else {
    const fitted = await fitForPreview(photo.data);
    const res = await new YouCamMakeup(client).render({
      image: { data: fitted.data, mimeType: 'image/jpeg', fileName: 'live-check.jpg' },
      effects: buildLipEffects(shadeHex!),
      onPhase: (p) => console.log(`  ${p}…`),
    });
    const info = res.ok ? await inspectOutput(res.output) : null;
    record.outcome = res.ok
      ? { ok: true, latencyMs: res.latencyMs, taskIdPrefix: res.taskId?.slice(0, 8), input: { width: fitted.width, height: fitted.height }, output: info, outputSha256: sha256Hex(res.output) }
      : { ok: false, code: res.code, message: res.message, retryable: res.retryable, taskIdPrefix: res.taskId?.slice(0, 8) };
    record.diagnostics = res.diagnostics;
    if (res.ok && keep && info) fs.writeFileSync(path.join(dir, `${stamp}-output.${info.mimeType === 'image/png' ? 'png' : 'jpg'}`), res.output);
  }
  const after = await balance();
  record.units = { before, after, spent: before !== null && after !== null ? Math.round((before - after) * 100) / 100 : null };
  const out = path.join(dir, `${stamp}-${check}.json`);
  fs.writeFileSync(out, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ outcome: (record.outcome as { ok: boolean }).ok, units: record.units }, null, 2));
  console.log(`Record written to ${path.relative(process.cwd(), out)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
