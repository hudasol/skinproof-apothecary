import { z } from 'zod';
import { GOALS } from '../domain/skin';

/**
 * Herbal teas for the goals a person is working on. Kept apart from the topical
 * botanical library on purpose: drinking a plant is a different exposure from
 * putting it on skin, and a tea has rarely been tested as a tea. Every entry
 * says what the evidence really tested (a drink, a powder or an extract) and
 * every claim carries its source.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const httpsUrl = z.url().refine((u) => u.startsWith('https://'), 'Use an https URL');
const slug = z.string().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/);

export const TEA_TIERS = ['human_trial', 'traditional', 'tested_not_helpful'] as const;
export type TeaTier = (typeof TEA_TIERS)[number];

export const TEA_PARTS = ['flower', 'leaf', 'root', 'fruit', 'calyx', 'aerial_parts'] as const;

export const TeaEvidenceSchema = z.object({
  id: slug,
  citation: z.object({
    authors: z.string().min(1),
    title: z.string().min(1),
    journal: z.string().min(1),
    year: z.number().int().min(1950).max(2100),
    pmid: z.string().regex(/^\d+$/),
    doi: z.string().nullable(),
    url: httpsUrl,
  }),
  design: z.enum(['systematic_review', 'rct', 'controlled_trial']),
  /** What people actually took. Only "brewed_drink" is a tea. */
  taken_as: z.enum(['brewed_drink', 'oral_powder', 'oral_extract', 'oral_extract_with_cream']),
  population: z.string().min(1),
  n: z.number().int().positive().nullable(),
  durationWeeks: z.number().positive().nullable(),
  summary: z.string().min(1),
  limitations: z.string().min(1),
  funding: z.string().nullable(),
});
export type TeaEvidence = z.infer<typeof TeaEvidenceSchema>;

export const TeaSchema = z.object({
  id: slug,
  commonName: z.string().min(1),
  scientificName: z.string().min(1),
  family: z.string().min(1),
  part: z.enum(TEA_PARTS),
  /** Id of the same plant in the topical library, when it has an entry there. */
  botanicalId: slug.nullable(),
  summary: z.string().min(1),
  goals: z
    .array(
      z.object({
        goal: z.enum(GOALS),
        tier: z.enum(TEA_TIERS),
        headline: z.string().min(1),
        detail: z.string().min(1),
        evidenceIds: z.array(slug),
        /** Sources for a traditional claim or a statement about missing evidence. */
        sources: z.array(z.object({ title: z.string().min(1), url: httpsUrl })),
      }),
    )
    .min(1),
  evidence: z.array(TeaEvidenceSchema),
  cautions: z.array(z.object({ note: z.string().min(1), source: z.object({ title: z.string().min(1), url: httpsUrl }) })),
  /** A plant from the daisy family (Asteraceae or Compositae). Left out when the person avoids that family. */
  daisyFamily: z.boolean(),
  /** Words a person might type in "ingredients to avoid" that should rule this tea out. */
  matchWords: z.array(z.string().min(3)).min(1),
  /** False when the tea is shown but never put in a blend, with the reason. */
  blend: z.discriminatedUnion('eligible', [z.object({ eligible: z.literal(true) }), z.object({ eligible: z.literal(false), reason: z.string().min(1) })]),
  reviewedOn: isoDate,
});
export type Tea = z.infer<typeof TeaSchema>;

export const TeaCatalogueSchema = z.array(TeaSchema);
