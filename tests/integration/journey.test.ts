import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDbForTesting, type Db } from '@/lib/db/client';
import { analyses, artifacts, consultations, decisions, previews } from '@/lib/db/schema';
import { resetEnvCache } from '@/lib/env';
import { EMPTY_CONSTRAINTS, type ConsultationProfile } from '@/lib/domain/profile';
import { getAnalysis, startAnalysis, waitForAnalysis } from '@/lib/services/analyses';
import { assertWithinBudget, unitsUsedToday } from '@/lib/services/budget';
import { createConsultation, deleteConsultation, purgeExpired, recordConsent, saveProfile, savePhoto } from '@/lib/services/consultations';
import { decide } from '@/lib/services/decisions';
import { getPreview, startPreview, waitForPreview } from '@/lib/services/previews';
import { syntheticJpeg } from '../helpers/images';

/**
 * The service layer end to end with the fixture providers: no network, no
 * units. Uses a throwaway database and data directory.
 */

let dir: string;
let db: Db;
let closeDb: () => void;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skinproof-it-'));
  process.env.DATA_DIR = dir;
  process.env.PROVIDER_MODE = 'fixture';
  process.env.FIXTURE_DELAY_MS = '0';
  process.env.SKINPROOF_LOG = 'silent';
  resetEnvCache();
  const handle = openDatabase(path.join(dir, 'test.sqlite'));
  setDbForTesting(handle);
  db = handle.db;
  closeDb = () => handle.sqlite.close();
});

afterAll(() => {
  setDbForTesting(undefined);
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

const profile = (over: Partial<ConsultationProfile> = {}): ConsultationProfile => ({
  goals: ['support_hydration'],
  goalOrigins: { support_hydration: 'analysis' },
  constraints: { ...EMPTY_CONSTRAINTS },
  reactiveSkin: false,
  preferredCategories: [],
  ...over,
});

const files = () => fs.readdirSync(path.join(dir, 'artifacts'), { recursive: true }).filter((f) => String(f).match(/\.(jpg|png)$/));

describe('consultation journey (fixture providers)', () => {
  it('needs consent before a photo is accepted', async () => {
    const c = createConsultation(db);
    await expect(savePhoto(db, c.id, await syntheticJpeg(800, 1000), null)).rejects.toMatchObject({ code: 'consent_required' });
  });

  it('analyses, decides reproducibly, previews within constraints, and deletes everything', async () => {
    const c = createConsultation(db);
    recordConsent(db, c.id, 'analysis');
    const photo = await savePhoto(db, c.id, await syntheticJpeg(800, 1000), { x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
    expect(photo.width).toBe(720);

    const job = await startAnalysis(db, c.id);
    expect(await startAnalysis(db, c.id)).toMatchObject({ id: job.id }); // a double click returns the same job
    await waitForAnalysis(job.id);
    const done = getAnalysis(db, job.id, c.id)!;
    expect(done.status).toBe('succeeded');
    expect(done.providerMode).toBe('fixture');
    expect(done.unitsEstimated).toBe(0);
    expect(done.result!.scores).toHaveLength(11);
    expect(getAnalysis(db, job.id, 'con_00000000000000000000')).toBeUndefined(); // other consultations cannot read it

    saveProfile(db, c.id, profile());
    const d1 = decide(db, c.id);
    expect(d1.decision.status).toBe('shortlist');
    expect(d1.decision.analysisId).toBe(job.id);
    expect(decide(db, c.id).id).toBe(d1.id); // same inputs, catalogue and rules: the stored decision

    saveProfile(db, c.id, profile({ constraints: { ...EMPTY_CONSTRAINTS, noFragrance: true } }));
    const d2 = decide(db, c.id);
    expect(d2.id).not.toBe(d1.id);
    expect(d2.decision.products.find((p) => p.productId === 'weleda-skin-food')?.outcome).toBe('excluded');

    await expect(startPreview(db, c.id, 'ilia-balmy-tint', 'lullaby')).rejects.toMatchObject({ code: 'consent_required' });
    recordConsent(db, c.id, 'preview');
    // Hurraw! lists Flavor/Aroma, which this person excluded: no try-on is offered.
    await expect(startPreview(db, c.id, 'hurraw-tinted-lip-balm', 'raspberry')).rejects.toMatchObject({ code: 'not_allowed' });
    // Burt's Bees publishes no swatch, so it has no colour to render.
    await expect(startPreview(db, c.id, 'burts-bees-tinted-lip-balm', 'rose')).rejects.toThrow(/no swatch/);
    // ILIA lists Vanillin, a scent material, so it is excluded too; lift the constraint to preview it.
    await expect(startPreview(db, c.id, 'ilia-balmy-tint', 'lullaby')).rejects.toMatchObject({ code: 'not_allowed' });
    saveProfile(db, c.id, profile());
    const pv = await startPreview(db, c.id, 'ilia-balmy-tint', 'lullaby');
    await waitForPreview(pv.id);
    const shown = getPreview(db, pv.id, c.id)!;
    expect(shown.status).toBe('succeeded');
    expect(shown.effects).toMatchObject({ effects: [{ category: 'skin_smooth', skinSmoothStrength: 0 }, { category: 'lip_color' }] });
    expect((await startPreview(db, c.id, 'ilia-balmy-tint', 'lullaby')).id).toBe(pv.id); // no second render of the same shade

    expect(files().length).toBeGreaterThanOrEqual(3);
    await deleteConsultation(db, c.id);
    for (const t of [consultations, analyses, decisions, previews]) {
      expect(db.select().from(t).all().filter((r) => ('consultationId' in r ? r.consultationId : r.id) === c.id)).toEqual([]);
    }
    expect(db.select().from(artifacts).all().filter((a) => a.consultationId === c.id)).toEqual([]);
  });

  it('reports a documented engine error with guidance for a very dark photo', async () => {
    const c = createConsultation(db);
    recordConsent(db, c.id, 'analysis');
    const dark = await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#0a0a0a' } }).jpeg().toBuffer();
    await savePhoto(db, c.id, dark, null);
    const job = await startAnalysis(db, c.id);
    await waitForAnalysis(job.id);
    const failed = getAnalysis(db, job.id, c.id)!;
    expect(failed.status).toBe('failed');
    expect(failed.failure).toMatchObject({ code: 'error_lighting_dark', retryable: false });
    expect(failed.failure!.guidance).toMatch(/light/);
  });

  it('deletes images after the retention period and keeps the scores', async () => {
    const c = createConsultation(db);
    recordConsent(db, c.id, 'analysis');
    await savePhoto(db, c.id, await syntheticJpeg(800, 1000, { seed: 3 }), null);
    const job = await startAnalysis(db, c.id);
    await waitForAnalysis(job.id);
    const later = new Date(Date.now() + 25 * 3_600_000);
    const res = await purgeExpired(db, later);
    expect(res.imagesDeleted).toBeGreaterThanOrEqual(1);
    expect(db.select().from(artifacts).all().filter((a) => a.consultationId === c.id)).toEqual([]);
    expect(getAnalysis(db, job.id, c.id)?.result?.scores.length).toBe(11);
    await expect(startAnalysis(db, c.id)).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('counts only live, non-failed tasks against the daily budget', () => {
    const c = createConsultation(db);
    const base = { consultationId: c.id, providerLabel: 'x', inputArtifactId: null, requestedConcerns: [], taskId: null, result: null, failure: null, diagnostics: {}, startedAt: null, finishedAt: null, createdAt: new Date() };
    db.insert(analyses).values([
      { ...base, id: 'ana_00000000000000000001', providerMode: 'live', status: 'succeeded', unitsEstimated: 14 },
      { ...base, id: 'ana_00000000000000000002', providerMode: 'live', status: 'failed', unitsEstimated: 14 },
      { ...base, id: 'ana_00000000000000000003', providerMode: 'fixture', status: 'succeeded', unitsEstimated: 0 },
    ]).run();
    expect(unitsUsedToday(db)).toBe(14);
    process.env.LIVE_DAILY_UNIT_BUDGET = '20';
    resetEnvCache();
    expect(() => assertWithinBudget(db, 14)).toThrow(/daily YouCam unit budget/);
    expect(() => assertWithinBudget(db, 1)).not.toThrow();
    delete process.env.LIVE_DAILY_UNIT_BUDGET;
    resetEnvCache();
  });
});
