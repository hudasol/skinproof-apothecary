import { z } from 'zod';
import { GOALS } from '../domain/skin';
import { PRODUCT_CATEGORIES } from '../domain/profile';

/**
 * Catalogue records (docs/CATALOGUE-METHOD.md). Every record carries its
 * source and the date it was checked. Unknown values are null, never guessed.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const httpsUrl = z.url().refine((u) => u.startsWith('https://'), 'Use an https URL');
const slug = z.string().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/);

export const PLANT_PARTS = ['leaf', 'root', 'seed', 'kernel', 'flower', 'fruit', 'bark', 'whole_plant', 'aerial_parts', 'unspecified'] as const;
/** How the plant material is prepared. "isolated_compound" means one named molecule (e.g. bakuchiol, madecassoside). */
export const PREPARATION_FORMS = ['extract', 'oil', 'juice_or_gel', 'colloidal_flour', 'distillate', 'isolated_compound', 'unspecified'] as const;
export const USE_TYPES = ['leave_on', 'rinse_off'] as const;

export const Preparation = z.object({
  part: z.enum(PLANT_PARTS),
  form: z.enum(PREPARATION_FORMS),
  /** Named compound when the study or product uses an isolated molecule, e.g. "bakuchiol". */
  compound: z.string().nullable(),
});
export type Preparation = z.infer<typeof Preparation>;

/** A concentration only ever as stated by the source; never inferred. */
export const StatedConcentration = z.object({
  percent: z.number().positive().max(100),
  /** Exact wording from the source, e.g. "Colloidal Oatmeal 1%". */
  wording: z.string().min(1),
});
export type StatedConcentration = z.infer<typeof StatedConcentration>;

export const SourceRef = z.object({ title: z.string().min(1), url: httpsUrl });

export const BotanicalSchema = z.object({
  id: slug,
  commonName: z.string().min(1),
  scientificName: z.string().min(1),
  family: z.string().min(1),
  /** Label names this plant appears under. Used for display and catalogue checks. */
  inciNames: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1),
  safetyNotes: z.array(z.object({ note: z.string().min(1), source: SourceRef })),
  reviewedOn: isoDate,
});
export type Botanical = z.infer<typeof BotanicalSchema>;

export const STUDY_DESIGNS = ['systematic_review', 'rct', 'controlled_trial', 'split_face', 'open_label', 'in_vitro', 'animal'] as const;
export type StudyDesign = (typeof STUDY_DESIGNS)[number];

export const StudySchema = z.object({
  id: slug,
  botanicalId: slug,
  citation: z.object({
    authors: z.string().min(1),
    title: z.string().min(1),
    journal: z.string().min(1),
    year: z.number().int().min(1950).max(2100),
    pmid: z.string().regex(/^\d+$/).nullable(),
    doi: z.string().nullable(),
    url: httpsUrl,
  }),
  design: z.enum(STUDY_DESIGNS),
  randomised: z.boolean().nullable(),
  blinded: z.enum(['double', 'single', 'none', 'unclear']),
  control: z.string().min(1),
  population: z.string().min(1),
  n: z.number().int().positive().nullable(),
  durationWeeks: z.number().positive().nullable(),
  preparation: Preparation,
  /** The study's own description of what was applied. */
  preparationText: z.string().min(1),
  concentration: StatedConcentration.nullable(),
  use: z.enum(USE_TYPES),
  outcomes: z
    .array(
      z.object({
        goal: z.enum(GOALS),
        measure: z.string().min(1),
        finding: z.enum(['supports', 'no_effect', 'mixed']),
        summary: z.string().min(1),
      }),
    )
    .min(1),
  limitations: z.string().min(1),
  funding: z.string().nullable(),
  reviewedOn: isoDate,
});
export type Study = z.infer<typeof StudySchema>;

export const ShadeSchema = z.object({
  id: slug,
  name: z.string().min(1),
  colourWords: z.string().nullable(),
  colourWordsSource: z.enum(['brand', 'retailer']).nullable(),
  swatch: z.object({ imageUrl: httpsUrl, pageUrl: httpsUrl }).nullable(),
  /**
   * Colour sent to the makeup try-on. Brands do not publish one, so it is
   * measured from the brand's swatch image (scripts/measure-swatches.ts) and
   * always shown as an approximation. Null means the shade cannot be previewed.
   */
  render: z
    .object({
      hex: z.string().regex(/^#[0-9A-F]{6}$/),
      method: z.literal('measured_from_brand_swatch'),
      measuredOn: isoDate,
      detail: z.string().min(1),
    })
    .nullable(),
  /** Shade-specific label, when shades differ by more than colourants. */
  ingredientsVerbatim: z.string().nullable(),
});
export type Shade = z.infer<typeof ShadeSchema>;

export const VERIFICATION_STATUSES = ['verified', 'partial', 'unverified'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ProductSchema = z.object({
  id: slug,
  brand: z.string().min(1),
  name: z.string().min(1),
  shelf: z.enum(['skincare', 'colour']),
  category: z.enum(PRODUCT_CATEGORIES),
  use: z.enum(USE_TYPES),
  source: z.object({
    url: httpsUrl,
    type: z.enum(['brand', 'retailer']),
    checkedOn: isoDate,
    secondaryUrl: httpsUrl.nullable(),
  }),
  /**
   * verified: the full ingredient list was copied from the source page.
   * partial: a list exists but something material is unresolved (see note).
   * unverified: no traceable full list.
   */
  verification: z.enum(VERIFICATION_STATUSES),
  verificationNote: z.string().nullable(),
  ingredientsVerbatim: z.string().nullable(),
  /** OTC Drug Facts actives with their stated percentage. */
  actives: z.array(StatedConcentration.extend({ name: z.string().min(1) })),
  /** Where two trustworthy sources disagree about the product. */
  sourceConflicts: z.string().nullable(),
  botanicals: z.array(
    z.object({
      /** Must appear verbatim in the ingredient list (checked by catalogue:check). */
      inci: z.string().min(1),
      botanicalId: slug,
      preparation: Preparation,
      /** Only when the brand states it; never inferred from list position. */
      concentration: StatedConcentration.nullable(),
    }),
  ),
  /** Official purchase or product pages only. No prices: none were verifiable. */
  retailers: z.array(z.object({ label: z.string().min(1), url: httpsUrl })),
  shades: z.array(ShadeSchema),
  /** Short, factual, in SkinProof's words. Not marketing copy. */
  description: z.string().min(1),
});
export type Product = z.infer<typeof ProductSchema>;

export const CatalogueSchema = z.object({
  botanicals: z.array(BotanicalSchema),
  studies: z.array(StudySchema),
  products: z.array(ProductSchema),
});
export type Catalogue = z.infer<typeof CatalogueSchema>;
