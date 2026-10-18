import 'server-only';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { artifacts, consultations, type Consultation } from '../db/schema';
import { newId } from '../domain/ids';
import type { ConsultationProfile } from '../domain/profile';
import { getEnv } from '../env';
import { deleteArtifacts, putArtifact, removeOrphanFiles } from '../storage/artifacts';
import { normalisePhoto, type Crop } from '../images/normalize';
import { AppError, notFound } from './errors';
import { log } from './log';

export function createConsultation(db: Db, now = new Date()): Consultation {
  const row: Consultation = {
    id: newId('consultation'),
    analysisConsentAt: null,
    previewConsentAt: null,
    profile: null,
    imagesExpireAt: null,
    expiresAt: new Date(now.getTime() + getEnv().consultationRetentionMs),
    createdAt: now,
    updatedAt: now,
  };
  db.insert(consultations).values(row).run();
  return row;
}

export function getConsultation(db: Db, id: string, now = new Date()): Consultation | null {
  const row = db.select().from(consultations).where(eq(consultations.id, id)).get();
  if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
  return row;
}

export function requireConsultation(db: Db, id: string | null): Consultation {
  const row = id ? getConsultation(db, id) : null;
  if (!row) throw notFound('Your consultation');
  return row;
}

export function recordConsent(db: Db, id: string, kind: 'analysis' | 'preview', now = new Date()): void {
  const field = kind === 'analysis' ? { analysisConsentAt: now } : { previewConsentAt: now };
  db.update(consultations).set({ ...field, updatedAt: now }).where(eq(consultations.id, id)).run();
}

export function saveProfile(db: Db, id: string, profile: ConsultationProfile, now = new Date()): void {
  db.update(consultations).set({ profile, updatedAt: now }).where(eq(consultations.id, id)).run();
}

/** The person's current photo, if it has not been deleted. */
export function currentPhoto(db: Db, consultationId: string) {
  return db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.consultationId, consultationId), eq(artifacts.kind, 'photo')))
    .orderBy(desc(artifacts.createdAt))
    .get();
}

/**
 * Store a new photo. Earlier photos, masks and try-on images for this
 * consultation are deleted first: SkinProof keeps one photo at a time.
 */
export async function savePhoto(db: Db, consultationId: string, bytes: Uint8Array, crop: Crop | null, now = new Date()) {
  const c = requireConsultation(db, consultationId);
  if (!c.analysisConsentAt) throw new AppError('consent_required', 'Please read and accept how your photo is used before uploading it.');
  const photo = await normalisePhoto(bytes, crop);
  const old = db.select({ id: artifacts.id }).from(artifacts).where(eq(artifacts.consultationId, consultationId)).all();
  await deleteArtifacts(db, old.map((o) => o.id));
  const row = await putArtifact(db, {
    consultationId,
    kind: 'photo',
    provenance: 'supplied',
    data: photo.data,
    mimeType: 'image/jpeg',
    width: photo.width,
    height: photo.height,
  });
  db.update(consultations)
    .set({ imagesExpireAt: new Date(now.getTime() + getEnv().imageRetentionMs), updatedAt: now })
    .where(eq(consultations.id, consultationId))
    .run();
  return row;
}

/** Delete one consultation and everything derived from it, files included. */
export async function deleteConsultation(db: Db, id: string): Promise<void> {
  const rows = db.select().from(artifacts).where(eq(artifacts.consultationId, id)).all();
  db.delete(consultations).where(eq(consultations.id, id)).run();
  await removeOrphanFiles(db, rows);
  log('info', 'consultation.deleted', { consultationId: id, files: rows.length });
}

/**
 * Retention (docs/PRIVACY.md): images are deleted RETENTION_HOURS after
 * upload; whole consultations after CONSULTATION_RETENTION_DAYS.
 */
export async function purgeExpired(db: Db, now = new Date()): Promise<{ imagesDeleted: number; consultationsDeleted: number }> {
  const imageDue = db
    .select({ id: consultations.id })
    .from(consultations)
    .where(lt(consultations.imagesExpireAt, now))
    .all()
    .map((r) => r.id);
  let imagesDeleted = 0;
  if (imageDue.length) {
    const rows = db.select({ id: artifacts.id }).from(artifacts).where(inArray(artifacts.consultationId, imageDue)).all();
    await deleteArtifacts(db, rows.map((r) => r.id));
    imagesDeleted = rows.length;
    db.update(consultations).set({ imagesExpireAt: null }).where(inArray(consultations.id, imageDue)).run();
  }
  const expired = db.select({ id: consultations.id }).from(consultations).where(lt(consultations.expiresAt, now)).all();
  for (const e of expired) await deleteConsultation(db, e.id);
  if (imagesDeleted || expired.length) log('info', 'retention.purged', { imagesDeleted, consultationsDeleted: expired.length });
  return { imagesDeleted, consultationsDeleted: expired.length };
}
