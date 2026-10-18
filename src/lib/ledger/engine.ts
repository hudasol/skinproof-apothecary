import { canonicalHash } from '../domain/canonical';
import type { Constraints } from '../domain/profile';
import { GOAL_LABELS, type Goal } from '../domain/skin';
import {
  findAsteraceae,
  findEssentialOils,
  findFragrance,
  findFragranceAllergens,
  findNamedIngredient,
  splitIngredients,
  type IngredientMatch,
} from '../catalogue/ingredients';
import type { Catalogue, Preparation, Product, Study } from '../catalogue/schema';
import { RULE_VERSION, SHORTLIST_SIZE } from './rules';
import type {
  Applicability,
  ColourCheck,
  EvidenceGrade,
  Factor,
  GoalAssessment,
  LedgerDecision,
  LedgerInput,
  Outcome,
  ProductAssessment,
} from './types';

/**
 * The Botanical Evidence Ledger (docs/LEDGER.md). Pure functions: the same
 * catalogue, input and rule version always produce the same decision. Nothing
 * here reads the clock except `evaluatedAt`, which is not part of the outcome.
 */

const HUMAN_DESIGNS = new Set<Study['design']>(['systematic_review', 'rct', 'controlled_trial', 'split_face', 'open_label']);
const QUALIFYING_GRADES = new Set<EvidenceGrade>(['strong', 'moderate', 'limited', 'conflicting']);

export const GRADE_ORDER: Record<EvidenceGrade, number> = {
  strong: 6,
  moderate: 5,
  limited: 4,
  conflicting: 4,
  not_supported: 2,
  preclinical: 1,
  none: 0,
};
export const APPLICABILITY_ORDER: Record<Applicability, number> = {
  close_match: 3,
  concentration_unknown: 2,
  weaker_match: 1,
  different_preparation: 0,
};

// ---------------------------------------------------------------- inputs

/** Canonical form of the inputs that can change a decision. */
export function normaliseInput(input: LedgerInput): LedgerInput {
  return {
    goals: [...new Set(input.goals)].sort(),
    constraints: {
      ...input.constraints,
      avoidIngredients: [...new Set(input.constraints.avoidIngredients.map((s) => s.trim().toLowerCase()))].sort(),
    },
    reactiveSkin: input.reactiveSkin,
    preferredCategories: [...new Set(input.preferredCategories)].sort(),
  };
}

export function inputsHash(input: LedgerInput): string {
  return canonicalHash(normaliseInput(input));
}

export function catalogueVersion(catalogue: Catalogue): string {
  return `cat-${canonicalHash(catalogue).slice(0, 16)}`;
}

// ---------------------------------------------------------------- evidence strength

/** Human studies of this goal that count towards a cosmetic grade (not medical settings). */
export function countedStudies(studies: Study[], goal: Goal): Study[] {
  return studies.filter((s) => HUMAN_DESIGNS.has(s.design) && s.setting !== 'medical' && s.outcomes.some((o) => o.goal === goal));
}

/**
 * Trial-grade evidence is a randomised trial in a cosmetic setting that
 * isolates the botanical. Non-randomised studies, acute irritation models and
 * trials of whole multi-ingredient products count as supporting evidence only
 * up to "limited". A systematic review that does not support the use caps the
 * grade at moderate; a supporting review counts as one trial.
 */
export function gradeEvidence(studies: Study[], goal: Goal): EvidenceGrade {
  const relevant = studies.flatMap((s) => s.outcomes.filter((o) => o.goal === goal).map((o) => ({ s, o })));
  if (relevant.length === 0) return 'none';
  const counted = relevant.filter(({ s }) => HUMAN_DESIGNS.has(s.design) && s.setting !== 'medical');
  const isTrial = (s: Study) => s.design === 'rct' && s.setting === 'cosmetic' && s.isolatesBotanical;
  const trialFor = counted.filter(({ s, o }) => isTrial(s) && o.finding === 'supports').length;
  const trialAgainst = counted.filter(({ s, o }) => isTrial(s) && o.finding !== 'supports').length;
  const reviewFor = counted.some(({ s, o }) => s.design === 'systematic_review' && o.finding === 'supports');
  const reviewAgainst = counted.some(({ s, o }) => s.design === 'systematic_review' && o.finding !== 'supports');
  const otherFor = counted.some(({ s, o }) => !isTrial(s) && s.design !== 'systematic_review' && o.finding === 'supports');

  if (trialFor > 0 && trialAgainst > 0) return 'conflicting';
  if (trialAgainst > 0) return otherFor || reviewFor ? 'conflicting' : 'not_supported';
  if (trialFor + (reviewFor ? 1 : 0) >= 2) return reviewAgainst ? 'moderate' : 'strong';
  if (trialFor === 1 || reviewFor) return 'moderate';
  if (otherFor) return 'limited';
  if (counted.length > 0) return 'not_supported';
  const preclinical = relevant.some(({ s, o }) => (s.design === 'in_vitro' || s.design === 'animal') && o.finding === 'supports');
  return preclinical ? 'preclinical' : 'none';
}

// ---------------------------------------------------------------- applicability

type PrepMatch = { matches: boolean; partUnconfirmed: boolean };

/** Is the product's ingredient the same preparation the study used? */
export function samePreparation(product: Preparation, study: Preparation): PrepMatch {
  if (study.compound || product.compound) {
    const same = !!study.compound && !!product.compound && study.compound.toLowerCase() === product.compound.toLowerCase();
    return { matches: same, partUnconfirmed: false };
  }
  if (product.form !== study.form) return { matches: false, partUnconfirmed: false };
  if (product.part === study.part) return { matches: true, partUnconfirmed: false };
  if (product.part === 'unspecified' || study.part === 'unspecified') return { matches: true, partUnconfirmed: true };
  return { matches: false, partUnconfirmed: false };
}

export function assessApplicability(
  ingredient: Product['botanicals'][number],
  productUse: Product['use'],
  matched: Study[],
  partUnconfirmed: boolean,
): { applicability: Applicability; reasons: string[] } {
  if (matched.length === 0) {
    return { applicability: 'different_preparation', reasons: ['The studies used a different part or form of this plant, or an isolated compound.'] };
  }
  const reasons: string[] = [];
  const sameUse = matched.some((s) => s.use === productUse);
  if (!sameUse) {
    reasons.push(
      productUse === 'rinse_off'
        ? 'Studied as a leave-on product; this one is rinsed off, so contact time is much shorter.'
        : 'Studied in a rinse-off product; this one is left on.',
    );
  }
  const studied = matched.map((s) => s.concentration?.percent).filter((p): p is number => typeof p === 'number');
  const stated = ingredient.concentration?.percent;
  let concentration: 'higher_or_equal' | 'lower' | 'unknown';
  if (stated === undefined) {
    concentration = 'unknown';
    reasons.push('The brand does not state how much is in the product.');
  } else if (studied.length === 0) {
    concentration = 'unknown';
    reasons.push('The brand states a concentration, but the studies do not, so they cannot be compared.');
  } else if (stated >= Math.min(...studied)) {
    concentration = 'higher_or_equal';
    reasons.push(`The brand states ${ingredient.concentration!.wording}; studies used ${formatList(studied.map((p) => `${p}%`))}.`);
  } else {
    concentration = 'lower';
    reasons.push(`The brand states ${ingredient.concentration!.wording}, lower than studied (${formatList(studied.map((p) => `${p}%`))}).`);
  }
  if (partUnconfirmed) reasons.push('The plant part is not stated on the label or in the study, so the match is not confirmed.');

  let applicability: Applicability;
  if (!sameUse || concentration === 'lower') applicability = 'weaker_match';
  else if (concentration === 'higher_or_equal' && !partUnconfirmed) applicability = 'close_match';
  else applicability = 'concentration_unknown';
  return { applicability, reasons };
}

function formatList(items: string[]): string {
  const u = [...new Set(items)];
  return u.length <= 1 ? (u[0] ?? '') : `${u.slice(0, -1).join(', ')} and ${u[u.length - 1]}`;
}

/** Assess every (ingredient, goal) link a product has to the person's goals. */
export function assessGoals(product: Product, goals: Goal[], studiesByBotanical: Map<string, Study[]>): GoalAssessment[] {
  const out: GoalAssessment[] = [];
  for (const goal of goals) {
    let best: GoalAssessment | null = null;
    for (const ing of product.botanicals) {
      const all = (studiesByBotanical.get(ing.botanicalId) ?? []).filter((s) => s.outcomes.some((o) => o.goal === goal));
      if (all.length === 0) continue;
      const matched: Study[] = [];
      let partUnconfirmed = false;
      for (const s of all) {
        const m = samePreparation(ing.preparation, s.preparation);
        if (m.matches) {
          matched.push(s);
          partUnconfirmed ||= m.partUnconfirmed;
        }
      }
      const grade = matched.length ? gradeEvidence(matched, goal) : gradeEvidence(all, goal);
      // Compare concentration and use against the studies that carry the grade, when there are any.
      const counted = countedStudies(matched, goal);
      const { applicability, reasons } = assessApplicability(ing, product.use, counted.length ? counted : matched, partUnconfirmed);
      const candidate: GoalAssessment = {
        goal,
        botanicalId: ing.botanicalId,
        inci: ing.inci,
        grade,
        gradeBasis: (matched.length ? matched : all).map((s) => s.id).sort(),
        otherPreparationStudies: all.filter((s) => !matched.includes(s)).map((s) => s.id).sort(),
        applicability,
        applicabilityReasons: reasons,
        qualifies: applicability !== 'different_preparation' && QUALIFYING_GRADES.has(grade),
      };
      if (!best || compareAssessments(candidate, best) < 0) best = candidate;
    }
    if (best) out.push(best);
  }
  return out;
}

/** Negative if a is better than b. Deterministic, ties broken by ingredient name. */
function compareAssessments(a: GoalAssessment, b: GoalAssessment): number {
  return (
    Number(b.qualifies) - Number(a.qualifies) ||
    GRADE_ORDER[b.grade] - GRADE_ORDER[a.grade] ||
    APPLICABILITY_ORDER[b.applicability] - APPLICABILITY_ORDER[a.applicability] ||
    a.inci.localeCompare(b.inci)
  );
}

// ---------------------------------------------------------------- hard constraints

export type LabelReading = {
  ingredients: string[];
  fragrance: IngredientMatch[];
  essentialOils: IngredientMatch[];
  allergens: IngredientMatch[];
  asteraceae: IngredientMatch[];
};

export function readLabel(verbatim: string): LabelReading {
  const ingredients = splitIngredients(verbatim);
  return {
    ingredients,
    fragrance: findFragrance(ingredients),
    essentialOils: findEssentialOils(ingredients),
    allergens: findFragranceAllergens(ingredients),
    asteraceae: findAsteraceae(ingredients),
  };
}

export function hasActiveConstraints(c: Constraints): boolean {
  return c.noFragrance || c.noEssentialOils || c.noFragranceAllergens || c.avoidAsteraceae || c.avoidIngredients.length > 0;
}

/** Apply the person's exclusions to one label. Every match becomes an `excludes` factor. */
export function constraintFactors(label: LabelReading, c: Constraints): Factor[] {
  const out: Factor[] = [];
  const add = (rule: Factor['rule'], matches: IngredientMatch[], why: string) => {
    for (const m of matches) {
      out.push({ rule, effect: 'excludes', ingredient: m.ingredient, message: m.note ? `${why} ${m.note}` : why });
    }
  };
  if (c.noFragrance) add('X1_fragrance', label.fragrance, 'Contains added fragrance or a scent material, which you asked to avoid.');
  if (c.noEssentialOils) add('X2_essential_oils', label.essentialOils, 'Contains an essential oil, which you asked to avoid.');
  if (c.noFragranceAllergens) add('X3_fragrance_allergens', label.allergens, 'Names a labelled fragrance allergen, which you asked to avoid.');
  if (c.avoidAsteraceae) add('X4_asteraceae', label.asteraceae, 'Contains a daisy-family (Asteraceae) plant, which you asked to avoid.');
  for (const term of c.avoidIngredients) {
    add('X5_named_ingredient', findNamedIngredient(label.ingredients, term), `Matches “${term}”, which you asked to avoid.`);
  }
  return out;
}

// ---------------------------------------------------------------- product outcome

export function assessProduct(product: Product, input: LedgerInput, studiesByBotanical: Map<string, Study[]>, catalogue: Catalogue): ProductAssessment {
  const factors: Factor[] = [];
  const c = input.constraints;
  const verbatim = product.ingredientsVerbatim;
  const label = verbatim ? readLabel(verbatim) : null;

  // Stage 1: hard exclusions. They are checked first and nothing later can undo them.
  if (label) {
    const excl = constraintFactors(label, c);
    if (excl.length) return finish(product, 'excluded', excl, assessGoals(product, input.goals, studiesByBotanical));
  }

  // Stage 2: product information.
  if (product.verification === 'unverified' || !label) {
    factors.push({
      rule: 'V1_unverified',
      effect: 'blocks',
      message: hasActiveConstraints(c)
        ? `No full ingredient list could be traced to a brand or retailer page, so your exclusions cannot be confirmed. ${product.verificationNote ?? ''}`.trim()
        : `No full ingredient list could be traced to a brand or retailer page. ${product.verificationNote ?? ''}`.trim(),
      sources: [product.source.url],
    });
    return finish(product, 'unverified', factors, assessGoals(product, input.goals, studiesByBotanical));
  }
  const cautions: Factor[] = [];
  if (product.verification === 'partial') {
    cautions.push({ rule: 'V2_partial', effect: 'cautions', message: product.verificationNote ?? 'Some product information is unresolved.', sources: [product.source.url] });
  }
  if (product.sourceConflicts) {
    cautions.push({ rule: 'V3_source_conflict', effect: 'cautions', message: product.sourceConflicts, sources: [product.source.url, ...(product.source.secondaryUrl ? [product.source.secondaryUrl] : [])] });
  }

  // Stage 3: relevance.
  const goals = assessGoals(product, input.goals, studiesByBotanical);
  if (goals.length === 0) {
    factors.push({ rule: 'R1_relevance', effect: 'blocks', message: 'None of its catalogue botanicals has a study measuring your goals.' });
    return finish(product, 'not_relevant', [...factors, ...cautions], goals);
  }

  // Stages 4–5: evidence and applicability, assessed separately per goal.
  for (const g of goals) {
    const botanical = catalogue.botanicals.find((b) => b.id === g.botanicalId);
    factors.push({
      rule: 'E1_grade',
      effect: 'informs',
      goal: g.goal,
      ingredient: g.inci,
      message: `${botanical?.commonName ?? g.botanicalId} for “${GOAL_LABELS[g.goal].short}”: evidence ${gradeLabel(g.grade)}.`,
      sources: g.gradeBasis,
    });
    factors.push({
      rule: 'A1_applicability',
      effect: g.qualifies ? 'qualifies' : 'informs',
      goal: g.goal,
      ingredient: g.inci,
      message: `${applicabilityLabel(g.applicability)}. ${g.applicabilityReasons.join(' ')}`,
    });
  }
  const qualifying = goals.filter((g) => g.qualifies);
  if (qualifying.length === 0) {
    factors.push({
      rule: 'Q1_qualifying_link',
      effect: 'blocks',
      message: 'No goal is backed by human evidence on the same preparation this product contains.',
    });
    return finish(product, 'limited_evidence', [...factors, ...cautions], goals);
  }
  factors.push({
    rule: 'Q1_qualifying_link',
    effect: 'qualifies',
    message: `${qualifying.length} of your goals ${qualifying.length === 1 ? 'is' : 'are'} backed by human evidence on a matching preparation.`,
  });

  for (const g of qualifying.filter((q) => q.grade === 'conflicting')) {
    cautions.push({ rule: 'C2_conflicting_evidence', effect: 'cautions', goal: g.goal, ingredient: g.inci, message: 'Randomised trials disagree for this goal.', sources: g.gradeBasis });
  }
  if (input.reactiveSkin) {
    const scent = [...label.fragrance, ...label.essentialOils, ...label.allergens];
    for (const m of dedupe(scent)) {
      cautions.push({ rule: 'C1_reactive_skin', effect: 'cautions', ingredient: m.ingredient, message: 'You said your skin reacts easily; this is a fragrance, essential oil or labelled fragrance allergen.' });
    }
    for (const ing of product.botanicals) {
      const b = catalogue.botanicals.find((x) => x.id === ing.botanicalId);
      for (const note of b?.safetyNotes ?? []) {
        cautions.push({ rule: 'C3_safety_note', effect: 'cautions', ingredient: ing.inci, message: note.note, sources: [note.source.url] });
      }
    }
  }
  return finish(product, cautions.length ? 'caution' : 'eligible', [...factors, ...cautions], goals, input);
}

function dedupe(matches: IngredientMatch[]): IngredientMatch[] {
  return [...new Map(matches.map((m) => [m.ingredient, m])).values()];
}

function finish(product: Product, outcome: Outcome, factors: Factor[], goals: GoalAssessment[], input?: LedgerInput): ProductAssessment {
  let rankKey: number[] | null = null;
  if ((outcome === 'eligible' || outcome === 'caution') && input) {
    const q = goals.filter((g) => g.qualifies);
    rankKey = [
      outcome === 'eligible' ? 1 : 0,
      q.filter((g) => g.grade === 'strong' || g.grade === 'moderate').length,
      Math.max(...q.map((g) => GRADE_ORDER[g.grade])),
      Math.max(...q.map((g) => APPLICABILITY_ORDER[g.applicability])),
      q.length,
      input.preferredCategories.includes(product.category) ? 1 : 0,
    ];
  }
  return { productId: product.id, outcome, factors, goals, rankKey, rank: null, tiedWith: [] };
}

export function compareRankKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// ---------------------------------------------------------------- decision

export function evaluate(
  catalogue: Catalogue,
  rawInput: LedgerInput,
  meta: { analysisId?: string | null; goalOrigins?: LedgerDecision['goalOrigins']; now?: Date } = {},
): LedgerDecision {
  const input = normaliseInput(rawInput);
  const studiesByBotanical = new Map<string, Study[]>();
  for (const s of catalogue.studies) {
    const list = studiesByBotanical.get(s.botanicalId) ?? [];
    list.push(s);
    studiesByBotanical.set(s.botanicalId, list);
  }
  const products = catalogue.products
    .filter((p) => p.shelf === 'skincare')
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => assessProduct(p, input, studiesByBotanical, catalogue));

  const ranked = products
    .filter((p) => p.rankKey)
    .sort((a, b) => compareRankKeys(a.rankKey!, b.rankKey!) || a.productId.localeCompare(b.productId));
  ranked.forEach((p, i) => {
    p.rank = i + 1;
    p.tiedWith = ranked.filter((o) => o !== p && compareRankKeys(o.rankKey!, p.rankKey!) === 0).map((o) => o.productId);
    p.factors.push({
      rule: 'K1_rank',
      effect: 'ranks',
      message: p.tiedWith.length
        ? `Ranked ${i + 1}; tied on every ranking key with ${p.tiedWith.length} other product${p.tiedWith.length === 1 ? '' : 's'} (listed alphabetically).`
        : `Ranked ${i + 1} of ${ranked.length} eligible products.`,
    });
  });

  const counts = { eligible: 0, caution: 0, excluded: 0, unverified: 0, limited_evidence: 0, not_relevant: 0 } as Record<Outcome, number>;
  for (const p of products) counts[p.outcome]++;
  const shortlist = ranked.slice(0, SHORTLIST_SIZE).map((p) => p.productId);
  return {
    ruleVersion: RULE_VERSION,
    catalogueVersion: catalogueVersion(catalogue),
    inputsHash: inputsHash(input),
    input,
    goalOrigins: meta.goalOrigins ?? {},
    analysisId: meta.analysisId ?? null,
    products,
    shortlist,
    status: shortlist.length ? 'shortlist' : 'no_match',
    counts,
    evaluatedAt: (meta.now ?? new Date()).toISOString(),
  };
}

/** Colour products: constraint and verification check per shade. No efficacy claim is made. */
export function checkColourShade(product: Product, shadeId: string, constraints: Constraints): ColourCheck {
  const shade = product.shades.find((s) => s.id === shadeId);
  const verbatim = shade?.ingredientsVerbatim ?? product.ingredientsVerbatim;
  if (!shade || !verbatim || product.verification === 'unverified') {
    return {
      productId: product.id,
      shadeId,
      outcome: 'unverified',
      factors: [{ rule: 'V1_unverified', effect: 'blocks', message: 'No full ingredient list could be traced for this shade, so your exclusions cannot be confirmed.' }],
    };
  }
  const excl = constraintFactors(readLabel(verbatim), constraints);
  if (excl.length) return { productId: product.id, shadeId, outcome: 'excluded', factors: excl };
  const factors: Factor[] = [];
  if (product.verification === 'partial' && product.verificationNote) {
    factors.push({ rule: 'V2_partial', effect: 'cautions', message: product.verificationNote });
  }
  return { productId: product.id, shadeId, outcome: 'passes', factors };
}

export function gradeLabel(g: EvidenceGrade): string {
  return {
    strong: 'strong',
    moderate: 'moderate',
    limited: 'limited',
    conflicting: 'conflicting',
    not_supported: 'not supported',
    preclinical: 'preclinical only',
    none: 'none found',
  }[g];
}

export function applicabilityLabel(a: Applicability): string {
  return {
    close_match: 'Close match to what was studied',
    concentration_unknown: 'Same preparation, concentration unknown',
    weaker_match: 'Weaker match to what was studied',
    different_preparation: 'Different preparation from what was studied',
  }[a];
}
