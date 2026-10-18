import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getProduct } from '../catalogue';
import type { Db } from '../db/client';
import { artifacts, previews, type JobFailure, type JobStatus, type Preview } from '../db/schema';
import { newId } from '../domain/ids';
import { EMPTY_CONSTRAINTS } from '../domain/profile';
import { MAKEUP_PREVIEW_UNITS } from '../domain/skin';
import { buildLipEffects } from '../domain/tryon';
import { fitForPreview, inspectOutput } from '../images/normalize';
import { checkColourShade } from '../ledger/engine';
import { makeupProvider } from '../providers';
import { putArtifact, readArtifact } from '../storage/artifacts';
import { assertWithinBudget } from './budget';
import { currentPhoto, requireConsultation } from './consultations';
import { AppError, notFound } from './errors';
import { log } from './log';

/**
 * Virtual try-on for colour-shelf shades. A preview is refused when the
 * shade breaks one of the person's exclusions: the Ledger's hard limits apply
 * to try-on too, so nothing excluded is ever shown as an option.
 */

const ACTIVE: JobStatus[] = ['queued', 'submitting', 'processing', 'downloading'];
const running = new Map<string, Promise<void>>();

export function previewsFor(db: Db, consultationId: string): Preview[] {
  return db.select().from(previews).where(eq(previews.consultationId, consultationId)).orderBy(desc(previews.createdAt)).all();
}

export function getPreview(db: Db, id: string, consultationId: string): Preview | undefined {
  return db.select().from(previews).where(and(eq(previews.id, id), eq(previews.consultationId, consultationId))).get();
}

export async function startPreview(db: Db, consultationId: string, productId: string, shadeId: string): Promise<Preview> {
  const c = requireConsultation(db, consultationId);
  if (!c.previewConsentAt) throw new AppError('consent_required', 'Please accept how try-on uses your photo first.');
  const product = getProduct(productId);
  const shade = product?.shelf === 'colour' ? product.shades.find((s) => s.id === shadeId) : undefined;
  if (!product || !shade) throw notFound('That shade');
  if (!shade.render) throw new AppError('not_allowed', 'This shade cannot be previewed: the brand publishes no swatch to take a colour from.');
  const check = checkColourShade(product, shadeId, c.profile?.constraints ?? EMPTY_CONSTRAINTS);
  if (check.outcome === 'excluded') {
    throw new AppError('not_allowed', `This shade is excluded by your choices: ${check.factors.map((f) => f.ingredient).filter(Boolean).join(', ')}.`);
  }
  if (check.outcome === 'unverified') throw new AppError('not_allowed', 'This shade’s ingredients could not be verified, so it is not offered for try-on.');
  const photo = currentPhoto(db, consultationId);
  if (!photo) throw new AppError('invalid_input', 'Add a photo first. Photos are deleted after a day.');

  const same = db
    .select()
    .from(previews)
    .where(and(eq(previews.consultationId, consultationId), eq(previews.productId, productId), eq(previews.shadeId, shadeId), inArray(previews.status, [...ACTIVE, 'succeeded'])))
    .orderBy(desc(previews.createdAt))
    .get();
  // Re-use a running or finished preview of this shade on the current photo instead of spending again.
  if (same && same.status !== 'succeeded') return same;
  if (same?.inputArtifactId) {
    const input = db.select().from(artifacts).where(eq(artifacts.id, same.inputArtifactId)).get();
    if (input && same.outputArtifactId && input.createdAt >= photo.createdAt) return same;
  }

  const provider = makeupProvider();
  if (!provider) throw new AppError('provider_unavailable', 'Live try-on is not configured on this server.');
  const units = provider.mode === 'live' ? MAKEUP_PREVIEW_UNITS : 0;
  if (provider.mode === 'live') assertWithinBudget(db, units);

  const fitted = await fitForPreview(await readArtifact(photo));
  const input = await putArtifact(db, {
    consultationId,
    kind: 'preview_input',
    provenance: 'supplied',
    data: fitted.data,
    mimeType: 'image/jpeg',
    width: fitted.width,
    height: fitted.height,
  });
  const row: Preview = {
    id: newId('preview'),
    consultationId,
    productId,
    shadeId,
    providerMode: provider.mode,
    providerLabel: provider.label,
    status: 'queued',
    unitsEstimated: units,
    inputArtifactId: input.id,
    outputArtifactId: null,
    effects: buildLipEffects(shade.render.hex),
    taskId: null,
    failure: null,
    diagnostics: {},
    startedAt: null,
    finishedAt: null,
    createdAt: new Date(),
  };
  db.insert(previews).values(row).run();
  const job = runPreview(db, row.id).finally(() => running.delete(row.id));
  running.set(row.id, job);
  return row;
}

export async function waitForPreview(id: string): Promise<void> {
  await running.get(id);
}

function update(db: Db, id: string, set: Partial<Preview>) {
  db.update(previews).set(set).where(eq(previews.id, id)).run();
}

async function runPreview(db: Db, id: string): Promise<void> {
  const row = db.select().from(previews).where(eq(previews.id, id)).get()!;
  const fail = (failure: JobFailure, diagnostics: Record<string, unknown> = {}, taskId: string | null = null) =>
    update(db, id, { status: 'failed', failure, diagnostics, taskId, finishedAt: new Date() });
  try {
    update(db, id, { status: 'submitting', startedAt: new Date() });
    const input = row.inputArtifactId ? db.select().from(artifacts).where(eq(artifacts.id, row.inputArtifactId)).get() : undefined;
    const provider = makeupProvider();
    if (!input) return fail({ code: 'photo_missing', message: 'Your photo was deleted before the try-on started.', guidance: 'Add it again.', retryable: false });
    if (!provider || provider.mode !== row.providerMode) return fail({ code: 'provider_changed', message: 'The try-on service changed before this job ran.', guidance: 'Try again.', retryable: true });
    const res = await provider.render({
      image: { data: await readArtifact(input), mimeType: 'image/jpeg', fileName: 'photo.jpg' },
      effects: row.effects as ReturnType<typeof buildLipEffects>,
      onPhase: (phase, detail) => update(db, id, { status: phase, ...(detail.taskId ? { taskId: detail.taskId } : {}) }),
    });
    if (!res.ok) {
      log('warn', 'preview.failed', { previewId: id, code: res.code, mode: row.providerMode });
      return fail({ code: res.code, message: res.message, guidance: res.guidance, retryable: res.retryable }, res.diagnostics, res.taskId);
    }
    const info = await inspectOutput(res.output);
    if (!info) return fail({ code: 'output_invalid', message: 'The try-on image could not be read.', guidance: 'Try again.', retryable: true }, res.diagnostics, res.taskId);
    const out = await putArtifact(db, {
      consultationId: row.consultationId,
      kind: 'preview_output',
      provenance: provider.mode,
      data: res.output,
      mimeType: info.mimeType,
      width: info.width,
      height: info.height,
    });
    update(db, id, { status: 'succeeded', outputArtifactId: out.id, diagnostics: res.diagnostics, taskId: res.taskId, finishedAt: new Date() });
    log('info', 'preview.succeeded', { previewId: id, mode: row.providerMode, ms: res.latencyMs });
  } catch (err) {
    log('error', 'preview.crashed', { previewId: id, error: err instanceof Error ? err.message : String(err) });
    fail({ code: 'internal_error', message: 'Something went wrong on our side during try-on.', guidance: 'Try again.', retryable: true });
  }
}

export function recoverInterruptedPreviews(db: Db): number {
  return db
    .update(previews)
    .set({
      status: 'interrupted',
      failure: { code: 'interrupted', message: 'The server restarted during this try-on.', guidance: 'Try again.', retryable: true },
      finishedAt: new Date(),
    })
    .where(inArray(previews.status, ACTIVE))
    .run().changes;
}
