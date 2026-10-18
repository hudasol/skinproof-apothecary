import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { analyses, artifacts, type Analysis, type JobFailure, type JobStatus } from '../db/schema';
import { newId } from '../domain/ids';
import { REQUESTED_CONCERNS, SKIN_ANALYSIS_UNITS } from '../domain/skin';
import { inspectOutput } from '../images/normalize';
import { skinAnalysisProvider } from '../providers';
import { putArtifact, readArtifact } from '../storage/artifacts';
import { assertWithinBudget } from './budget';
import { currentPhoto, requireConsultation } from './consultations';
import { AppError } from './errors';
import { log } from './log';

/**
 * Skin analysis jobs. A job runs in the web process (TryOn TD-2): the request
 * returns at once and the browser polls /api/analyses/[id]. A restart marks
 * in-flight jobs as interrupted so the person can retry.
 */

const ACTIVE: JobStatus[] = ['queued', 'submitting', 'processing', 'downloading'];
const running = new Map<string, Promise<void>>();

export function latestAnalysis(db: Db, consultationId: string): Analysis | undefined {
  return db.select().from(analyses).where(eq(analyses.consultationId, consultationId)).orderBy(desc(analyses.createdAt)).get();
}

export function getAnalysis(db: Db, id: string, consultationId: string): Analysis | undefined {
  return db.select().from(analyses).where(and(eq(analyses.id, id), eq(analyses.consultationId, consultationId))).get();
}

export async function startAnalysis(db: Db, consultationId: string): Promise<Analysis> {
  const c = requireConsultation(db, consultationId);
  if (!c.analysisConsentAt) throw new AppError('consent_required', 'Please read and accept how your photo is used first.');
  const photo = currentPhoto(db, consultationId);
  if (!photo) throw new AppError('invalid_input', 'Upload a photo first. Photos are deleted after a day, so you may need to add it again.');

  // A second click while one is running returns the running job.
  const active = db
    .select()
    .from(analyses)
    .where(and(eq(analyses.consultationId, consultationId), inArray(analyses.status, ACTIVE)))
    .get();
  if (active) return active;

  const provider = skinAnalysisProvider();
  if (!provider) throw new AppError('provider_unavailable', 'Live skin analysis is not configured on this server.');
  const units = provider.mode === 'live' ? SKIN_ANALYSIS_UNITS : 0;
  if (provider.mode === 'live') assertWithinBudget(db, units);

  const row: Analysis = {
    id: newId('analysis'),
    consultationId,
    providerMode: provider.mode,
    providerLabel: provider.label,
    status: 'queued',
    inputArtifactId: photo.id,
    requestedConcerns: [...REQUESTED_CONCERNS],
    unitsEstimated: units,
    taskId: null,
    result: null,
    failure: null,
    diagnostics: {},
    startedAt: null,
    finishedAt: null,
    createdAt: new Date(),
  };
  db.insert(analyses).values(row).run();
  const job = runAnalysis(db, row.id).finally(() => running.delete(row.id));
  running.set(row.id, job);
  return row;
}

/** Wait for a running job (tests and scripts). */
export async function waitForAnalysis(id: string): Promise<void> {
  await running.get(id);
}

function update(db: Db, id: string, set: Partial<Analysis>) {
  db.update(analyses).set(set).where(eq(analyses.id, id)).run();
}

async function runAnalysis(db: Db, id: string): Promise<void> {
  const row = db.select().from(analyses).where(eq(analyses.id, id)).get()!;
  const fail = (failure: JobFailure, diagnostics: Record<string, unknown> = {}, taskId: string | null = null) =>
    update(db, id, { status: 'failed', failure, diagnostics, taskId, finishedAt: new Date() });
  try {
    update(db, id, { status: 'submitting', startedAt: new Date() });
    const photo = row.inputArtifactId ? db.select().from(artifacts).where(eq(artifacts.id, row.inputArtifactId)).get() : undefined;
    if (!photo) return fail({ code: 'photo_missing', message: 'Your photo was deleted before the analysis started.', guidance: 'Upload it again.', retryable: false });
    const provider = skinAnalysisProvider();
    if (!provider || provider.mode !== row.providerMode) {
      return fail({ code: 'provider_changed', message: 'The analysis service changed before this job ran.', guidance: 'Try again.', retryable: true });
    }
    const data = await readArtifact(photo);
    const res = await provider.analyze({
      image: { data, mimeType: 'image/jpeg', fileName: 'photo.jpg' },
      concerns: row.requestedConcerns,
      onPhase: (phase, detail) => update(db, id, { status: phase, ...(detail.taskId ? { taskId: detail.taskId } : {}) }),
    });
    if (!res.ok) {
      log('warn', 'analysis.failed', { analysisId: id, code: res.code, mode: row.providerMode });
      return fail({ code: res.code, message: res.message, guidance: res.guidance, retryable: res.retryable }, res.diagnostics, res.taskId);
    }
    // Store masks as images tied to this consultation; they are deleted with the photo.
    const maskIds = new Map<string, string>();
    for (const m of res.masks) {
      const info = await inspectOutput(m.data);
      if (!info) {
        res.diagnostics[`mask_${m.concern}Invalid`] = true;
        continue;
      }
      const a = await putArtifact(db, {
        consultationId: row.consultationId,
        kind: 'mask',
        provenance: provider.mode,
        data: m.data,
        mimeType: info.mimeType,
        width: info.width,
        height: info.height,
      });
      maskIds.set(m.concern, a.id);
    }
    const result = { ...res.result, scores: res.result.scores.map((s) => ({ ...s, maskArtifactId: maskIds.get(s.concern) ?? null })) };
    update(db, id, { status: 'succeeded', result, diagnostics: res.diagnostics, taskId: res.taskId, finishedAt: new Date() });
    log('info', 'analysis.succeeded', { analysisId: id, mode: row.providerMode, scores: result.scores.length, masks: maskIds.size, ms: res.latencyMs });
  } catch (err) {
    log('error', 'analysis.crashed', { analysisId: id, error: err instanceof Error ? err.message : String(err) });
    fail({ code: 'internal_error', message: 'Something went wrong on our side while analysing your photo.', guidance: 'Try again.', retryable: true });
  }
}

/** On boot: jobs that were mid-flight when the server stopped cannot resume. */
export function recoverInterruptedAnalyses(db: Db): number {
  const res = db
    .update(analyses)
    .set({
      status: 'interrupted',
      failure: { code: 'interrupted', message: 'The server restarted while your analysis was running.', guidance: 'Run it again.', retryable: true },
      finishedAt: new Date(),
    })
    .where(inArray(analyses.status, ACTIVE))
    .run();
  return res.changes;
}
