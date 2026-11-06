import { z } from 'zod';
import { GOALS, type Goal } from './skin';

/**
 * What the person tells SkinProof. Goals steer relevance and ranking;
 * constraints are hard exclusions that nothing downstream may override.
 */

export const PRODUCT_CATEGORIES = ['cleanser', 'toner', 'serum', 'moisturiser', 'balm', 'oil', 'gel', 'treatment', 'lip'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  serum: 'Serum',
  moisturiser: 'Moisturiser',
  balm: 'Balm',
  oil: 'Face oil',
  gel: 'Gel',
  treatment: 'Treatment',
  lip: 'Lip',
};

export type Constraints = {
  /** Exclude products listing Parfum, Fragrance, Aroma or Flavor. */
  noFragrance: boolean;
  /** Exclude products containing a listed essential oil. */
  noEssentialOils: boolean;
  /** Exclude products naming any EU-labelled fragrance allergen (Limonene, Linalool…). */
  noFragranceAllergens: boolean;
  /** Exclude products containing a plant from the daisy family (Asteraceae / Compositae). */
  avoidAsteraceae: boolean;
  /** Free-text ingredient names to exclude, matched against each ingredient on the label. */
  avoidIngredients: string[];
};

export type ConsultationProfile = {
  goals: Goal[];
  /** Where each goal came from, so the dossier can say "suggested by your analysis" or "chosen by you". */
  goalOrigins: Partial<Record<Goal, 'analysis' | 'person'>>;
  /** Limits for skincare. Hard exclusions for the shortlist. */
  constraints: Constraints;
  /**
   * Limits for makeup (lip colour). Kept apart from skincare on purpose: a person
   * may accept fragrance in a lip tint but not in a serum, or the reverse.
   * Absent on consultations saved before this existed, which means no makeup limits.
   */
  makeupConstraints?: Constraints;
  /** "My skin reacts easily": not an exclusion, but fragranced products get a caution. */
  reactiveSkin: boolean;
  /** Soft preference used only as a late ranking key. */
  preferredCategories: ProductCategory[];
};

export const EMPTY_CONSTRAINTS: Constraints = {
  noFragrance: false,
  noEssentialOils: false,
  noFragranceAllergens: false,
  avoidAsteraceae: false,
  avoidIngredients: [],
};

/** The makeup limits of a profile, or none when the person has not set any. */
export function makeupLimitsOf(profile: ConsultationProfile | null | undefined): Constraints {
  return profile?.makeupConstraints ?? EMPTY_CONSTRAINTS;
}

const constraintsSchema = z.object({
  noFragrance: z.boolean(),
  noEssentialOils: z.boolean(),
  noFragranceAllergens: z.boolean(),
  avoidAsteraceae: z.boolean(),
  avoidIngredients: z.array(z.string().trim().min(3, 'Use at least 3 characters').max(60, 'Keep each ingredient under 60 characters').regex(/^[\p{L}\p{N} .,()\-'/&]+$/u, 'Use letters, numbers and simple punctuation only')).max(10, 'Up to ten ingredients'),
});

export const ProfileSchema = z.object({
  goals: z.array(z.enum(GOALS)).min(1, 'Choose at least one goal').max(3, 'Choose up to three goals'),
  goalOrigins: z.partialRecord(z.enum(GOALS), z.enum(['analysis', 'person'])).default({}),
  constraints: constraintsSchema,
  makeupConstraints: constraintsSchema.default(EMPTY_CONSTRAINTS),
  reactiveSkin: z.boolean(),
  preferredCategories: z.array(z.enum(PRODUCT_CATEGORIES)).max(PRODUCT_CATEGORIES.length),
});

/** Parse the consultation form. Checkbox fields are present only when ticked. */
export function profileFromForm(form: FormData): z.ZodSafeParseResult<ConsultationProfile> {
  const goals = form.getAll('goals').map(String);
  const suggested = new Set(form.getAll('suggestedGoals').map(String));
  const origins: Record<string, 'analysis' | 'person'> = {};
  for (const g of goals) origins[g] = suggested.has(g) ? 'analysis' : 'person';
  const readAvoid = (field: string) => {
    const avoid = String(form.get(field) ?? '')
      .split(/[\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Map(avoid.map((a) => [a.toLowerCase(), a])).values()];
  };
  const readLimits = (prefix: string) => ({
    noFragrance: form.get(`${prefix}noFragrance`) === 'on',
    noEssentialOils: form.get(`${prefix}noEssentialOils`) === 'on',
    noFragranceAllergens: form.get(`${prefix}noFragranceAllergens`) === 'on',
    avoidAsteraceae: form.get(`${prefix}avoidAsteraceae`) === 'on',
    avoidIngredients: readAvoid(`${prefix}avoidIngredients`),
  });
  return ProfileSchema.safeParse({
    goals: [...new Set(goals)],
    goalOrigins: origins,
    constraints: readLimits(''),
    makeupConstraints: readLimits('makeup_'),
    reactiveSkin: form.get('reactiveSkin') === 'on',
    preferredCategories: [...new Set(form.getAll('preferredCategories').map(String))],
  }) as z.ZodSafeParseResult<ConsultationProfile>;
}
