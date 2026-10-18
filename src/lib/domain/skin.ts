/**
 * Skin analysis domain: the YouCam concerns SkinProof requests, the cosmetic
 * goals the catalogue is organised around, and the documented mapping between
 * them. Shared by server and browser code; no provider types leak in here.
 */

/** SD concerns sent to YouCam (docs/API-VERIFICATION.md). 12 SD concerns cost 14 units. */
export const REQUESTED_CONCERNS = [
  'redness',
  'oiliness',
  'moisture',
  'texture',
  'pore',
  'acne',
  'radiance',
  'age_spot',
  'wrinkle',
  'firmness',
  'dark_circle_v2',
  'skin_type',
] as const;

export type RequestedConcern = (typeof REQUESTED_CONCERNS)[number];
/** Scored concerns: everything except skin_type, which returns a category. */
export type ScoredConcern = Exclude<RequestedConcern, 'skin_type'>;
export const SCORED_CONCERNS = REQUESTED_CONCERNS.filter((c): c is ScoredConcern => c !== 'skin_type');

/** Documented unit cost for the request above (Skin Analysis unit table, 9–12 SD concerns). */
export const SKIN_ANALYSIS_UNITS = 14;
export const MAKEUP_PREVIEW_UNITS = 1;

export const CONCERN_LABELS: Record<ScoredConcern, { label: string; plain: string }> = {
  redness: { label: 'Redness', plain: 'How much visible redness the model detected.' },
  oiliness: { label: 'Oiliness', plain: 'How much surface shine and oil the model detected.' },
  moisture: { label: 'Moisture', plain: 'The model’s estimate of surface hydration.' },
  texture: { label: 'Texture', plain: 'How smooth or uneven the skin surface looks.' },
  pore: { label: 'Pores', plain: 'How visible pores are.' },
  acne: { label: 'Blemishes', plain: 'Visible spots and blemishes the model detected.' },
  radiance: { label: 'Radiance', plain: 'How bright and even the skin’s reflection looks.' },
  age_spot: { label: 'Dark spots', plain: 'Visible spots and patches of pigmentation.' },
  wrinkle: { label: 'Lines', plain: 'Visible lines and wrinkles.' },
  firmness: { label: 'Firmness', plain: 'The model’s estimate of visible firmness.' },
  dark_circle_v2: { label: 'Under-eye shadow', plain: 'Darkness under the eyes.' },
};

/** Cosmetic goals. These are appearance goals, never medical conditions. */
export const GOALS = [
  'calm_visible_redness',
  'support_hydration',
  'balance_oil',
  'blemish_care',
  'even_tone',
  'smooth_fine_lines',
  'radiance',
  'refine_texture',
] as const;
export type Goal = (typeof GOALS)[number];

export const GOAL_LABELS: Record<Goal, { label: string; short: string }> = {
  calm_visible_redness: { label: 'Calm the look of redness', short: 'Redness' },
  support_hydration: { label: 'Support hydration and the skin barrier', short: 'Hydration' },
  balance_oil: { label: 'Balance shine and oil', short: 'Oil balance' },
  blemish_care: { label: 'Care for blemish-prone skin', short: 'Blemishes' },
  even_tone: { label: 'Even out the look of dark spots', short: 'Even tone' },
  smooth_fine_lines: { label: 'Soften the look of fine lines', short: 'Fine lines' },
  radiance: { label: 'Restore a look of radiance', short: 'Radiance' },
  refine_texture: { label: 'Refine the look of texture', short: 'Texture' },
};

/**
 * Which goal a concern points to. This mapping is SkinProof's own editorial
 * choice, not something YouCam returns. Under-eye shadow maps to no goal:
 * no botanical in the catalogue has topical human evidence for it.
 */
export const CONCERN_TO_GOAL: Record<ScoredConcern, Goal | null> = {
  redness: 'calm_visible_redness',
  moisture: 'support_hydration',
  oiliness: 'balance_oil',
  acne: 'blemish_care',
  age_spot: 'even_tone',
  wrinkle: 'smooth_fine_lines',
  firmness: 'smooth_fine_lines',
  radiance: 'radiance',
  texture: 'refine_texture',
  pore: 'refine_texture',
  dark_circle_v2: null,
};

export const SKIN_TYPES = [
  'Normal',
  'Oily',
  'Dry',
  'Combination',
  'Redness',
  'Dry & Redness',
  'Oily & Redness',
  'Combination & Redness',
] as const;

/** One concern score as YouCam returned it. Higher scores mean the model rated the area healthier. */
export type ConcernScore = {
  concern: ScoredConcern;
  /** "the score directly predicted by the AI model", 1–100. The only score SkinProof reasons with. */
  rawScore: number;
  /** YouCam's deliberately favourable display score. Recorded for transparency, never used. */
  uiScore: number | null;
  /** Mask stored for this concern, if the provider returned one and it was kept. */
  maskArtifactId: string | null;
};

export type SkinTypeZone = 'whole' | 't_zone' | 'u_zone';

/** The normalised result of one analysis. Unknown values stay absent, never guessed. */
export type SkinAnalysisResult = {
  scores: ConcernScore[];
  skinType: Partial<Record<SkinTypeZone, string>>;
  /** Concerns that were requested but not returned. */
  missing: RequestedConcern[];
  /** Output item types we did not ask for or do not use (e.g. skin_age, all). Names only, no values. */
  ignoredTypes: string[];
};

export type FocusSuggestion = { goal: Goal; concern: ScoredConcern; rawScore: number };

/**
 * Suggest up to `limit` goals from an analysis: the concerns with the lowest
 * raw scores *relative to the person's own other scores*, mapped to goals.
 * There is no absolute threshold: YouCam does not publish what a given score
 * means clinically, and SkinProof does not invent one. Ties are broken by the
 * fixed order of REQUESTED_CONCERNS so the same result always gives the same
 * suggestion.
 */
export function suggestFocus(result: SkinAnalysisResult, limit = 3): FocusSuggestion[] {
  const order = (c: ScoredConcern) => SCORED_CONCERNS.indexOf(c);
  const ranked = result.scores
    .filter((s) => CONCERN_TO_GOAL[s.concern] !== null)
    .slice()
    .sort((a, b) => a.rawScore - b.rawScore || order(a.concern) - order(b.concern));
  const out: FocusSuggestion[] = [];
  for (const s of ranked) {
    const goal = CONCERN_TO_GOAL[s.concern]!;
    if (out.some((o) => o.goal === goal)) continue;
    out.push({ goal, concern: s.concern, rawScore: s.rawScore });
    if (out.length >= limit) break;
  }
  return out;
}
