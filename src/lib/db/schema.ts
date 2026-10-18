import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import type { ProviderMode } from '../env';
import type { RequestedConcern, SkinAnalysisResult } from '../domain/skin';
import type { ConsultationProfile } from '../domain/profile';
import type { LedgerDecision } from '../ledger/types';

/**
 * Persistence keeps only what the product needs (docs/PRIVACY.md):
 * photos, masks and try-on images are deleted after RETENTION_HOURS; raw
 * provider payloads are never stored, only normalised values and the names
 * and types of unexpected fields.
 */

/** live = real YouCam output · fixture = built-in offline provider · supplied = uploaded by the user · derived = computed here. */
export type Provenance = 'live' | 'fixture' | 'supplied' | 'derived';

const createdAt = () => integer('created_at', { mode: 'timestamp_ms' }).notNull();

export const consultations = sqliteTable(
  'consultations',
  {
    id: text('id').primaryKey(),
    /** When the person agreed to send a photo to YouCam for skin analysis. */
    analysisConsentAt: integer('analysis_consent_at', { mode: 'timestamp_ms' }),
    /** Separate agreement for virtual try-on, asked when first used. */
    previewConsentAt: integer('preview_consent_at', { mode: 'timestamp_ms' }),
    /** Goals, constraints and preferences chosen by the person. */
    profile: text('profile', { mode: 'json' }).$type<ConsultationProfile | null>(),
    imagesExpireAt: integer('images_expire_at', { mode: 'timestamp_ms' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('consultations_expires_idx').on(t.expiresAt)],
);

export const artifacts = sqliteTable(
  'artifacts',
  {
    id: text('id').primaryKey(),
    consultationId: text('consultation_id').references(() => consultations.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['photo', 'analysis_input', 'mask', 'preview_input', 'preview_output'] }).notNull(),
    provenance: text('provenance').$type<Provenance>().notNull(),
    sha256: text('sha256').notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: createdAt(),
  },
  (t) => [index('artifacts_sha_idx').on(t.sha256), index('artifacts_consultation_idx').on(t.consultationId)],
);

export type JobStatus = 'queued' | 'submitting' | 'processing' | 'downloading' | 'succeeded' | 'failed' | 'interrupted';

export type JobFailure = {
  code: string;
  /** Safe to show to the person. */
  message: string;
  /** What the person can do about it, in plain words. */
  guidance: string | null;
  retryable: boolean;
};

export const analyses = sqliteTable(
  'analyses',
  {
    id: text('id').primaryKey(),
    consultationId: text('consultation_id')
      .notNull()
      .references(() => consultations.id, { onDelete: 'cascade' }),
    providerMode: text('provider_mode').$type<ProviderMode>().notNull(),
    providerLabel: text('provider_label').notNull(),
    status: text('status').$type<JobStatus>().notNull(),
    inputArtifactId: text('input_artifact_id').references(() => artifacts.id, { onDelete: 'set null' }),
    requestedConcerns: text('requested_concerns', { mode: 'json' }).$type<RequestedConcern[]>().notNull(),
    unitsEstimated: integer('units_estimated').notNull(),
    taskId: text('task_id'),
    result: text('result', { mode: 'json' }).$type<SkinAnalysisResult | null>(),
    failure: text('failure', { mode: 'json' }).$type<JobFailure | null>(),
    /** Statuses, timings, counts and field shapes only. Never keys, URLs or values. */
    diagnostics: text('diagnostics', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [index('analyses_consultation_idx').on(t.consultationId), index('analyses_created_idx').on(t.createdAt)],
);

export const decisions = sqliteTable(
  'decisions',
  {
    id: text('id').primaryKey(),
    consultationId: text('consultation_id')
      .notNull()
      .references(() => consultations.id, { onDelete: 'cascade' }),
    analysisId: text('analysis_id').references(() => analyses.id, { onDelete: 'set null' }),
    ruleVersion: text('rule_version').notNull(),
    catalogueVersion: text('catalogue_version').notNull(),
    /** Hash of the inputs that can change the outcome: same hash + versions → same decision. */
    inputsHash: text('inputs_hash').notNull(),
    decision: text('decision', { mode: 'json' }).$type<LedgerDecision>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('decisions_consultation_idx').on(t.consultationId)],
);

export const previews = sqliteTable(
  'previews',
  {
    id: text('id').primaryKey(),
    consultationId: text('consultation_id')
      .notNull()
      .references(() => consultations.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull(),
    shadeId: text('shade_id').notNull(),
    providerMode: text('provider_mode').$type<ProviderMode>().notNull(),
    providerLabel: text('provider_label').notNull(),
    status: text('status').$type<JobStatus>().notNull(),
    unitsEstimated: integer('units_estimated').notNull(),
    inputArtifactId: text('input_artifact_id').references(() => artifacts.id, { onDelete: 'set null' }),
    outputArtifactId: text('output_artifact_id').references(() => artifacts.id, { onDelete: 'set null' }),
    /** Exact effects payload sent to the provider. */
    effects: text('effects', { mode: 'json' }).$type<unknown>().notNull(),
    taskId: text('task_id'),
    failure: text('failure', { mode: 'json' }).$type<JobFailure | null>(),
    diagnostics: text('diagnostics', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [index('previews_consultation_idx').on(t.consultationId), index('previews_created_idx').on(t.createdAt)],
);

export type Consultation = typeof consultations.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type Preview = typeof previews.$inferSelect;
