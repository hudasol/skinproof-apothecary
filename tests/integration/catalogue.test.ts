import { describe, expect, it } from 'vitest';
import { checkCatalogue, getCatalogue } from '@/lib/catalogue';
import { EMPTY_CONSTRAINTS, type Constraints } from '@/lib/domain/profile';
import { GOALS, type Goal } from '@/lib/domain/skin';
import { evaluate } from '@/lib/ledger/engine';
import { RULES } from '@/lib/ledger/rules';

/** Invariants of the Ledger on the real, curated catalogue. */

const cat = getCatalogue();
const goalSets: Goal[][] = [...GOALS.map((g) => [g]), ...GOALS.flatMap((a, i) => GOALS.slice(i + 1).map((b) => [a, b]))];
const constraintSets: Constraints[] = [
  EMPTY_CONSTRAINTS,
  { ...EMPTY_CONSTRAINTS, noFragrance: true },
  { ...EMPTY_CONSTRAINTS, noEssentialOils: true, noFragranceAllergens: true },
  { ...EMPTY_CONSTRAINTS, avoidAsteraceae: true },
  { ...EMPTY_CONSTRAINTS, avoidIngredients: ['Alcohol Denat.', 'lanolin'] },
];
const ruleIds = new Set(RULES.map((r) => r.id));

describe('curated catalogue', () => {
  it('passes every cross-reference check', () => {
    expect(checkCatalogue(cat)).toEqual([]);
    expect(cat.products.filter((p) => p.shelf === 'skincare').length).toBeGreaterThanOrEqual(15);
    expect(cat.botanicals.length).toBeGreaterThanOrEqual(8);
  });

  it('never shortlists an unverified or excluded product, for any goals and constraints', () => {
    for (const goals of goalSets) {
      for (const constraints of constraintSets) {
        for (const reactiveSkin of [false, true]) {
          const d = evaluate(cat, { goals, constraints, reactiveSkin, preferredCategories: [] });
          for (const id of d.shortlist) {
            const p = d.products.find((x) => x.productId === id)!;
            expect(['eligible', 'caution']).toContain(p.outcome);
            expect(p.factors.some((f) => f.effect === 'excludes')).toBe(false);
            expect(cat.products.find((x) => x.id === id)!.verification).not.toBe('unverified');
          }
          for (const p of d.products) for (const f of p.factors) expect(ruleIds.has(f.rule)).toBe(true);
        }
      }
    }
  });

  it('says honestly when nothing qualifies', () => {
    const none = (goal: Goal) => evaluate(cat, { goals: [goal], constraints: EMPTY_CONSTRAINTS, reactiveSkin: false, preferredCategories: [] });
    expect(none('balance_oil').status).toBe('no_match');
    expect(none('radiance').status).toBe('no_match');
  });

  it('excludes the fragranced cream with daisy-family extracts for either constraint', () => {
    for (const c of [{ noFragrance: true }, { avoidAsteraceae: true }]) {
      const d = evaluate(cat, { goals: ['support_hydration'], constraints: { ...EMPTY_CONSTRAINTS, ...c }, reactiveSkin: false, preferredCategories: [] });
      expect(d.products.find((p) => p.productId === 'weleda-skin-food')!.outcome).toBe('excluded');
    }
  });

  it('does not let a named ingredient stand in for evidence on a different preparation', () => {
    const d = evaluate(cat, { goals: ['even_tone'], constraints: EMPTY_CONSTRAINTS, reactiveSkin: false, preferredCategories: [] });
    // Licorice tone studies used glabridin; Eucerin uses licochalcone A.
    const eucerin = d.products.find((p) => p.productId === 'eucerin-anti-redness-soothing-care')!;
    expect(eucerin.outcome).toBe('limited_evidence');
    expect(eucerin.goals[0]!.applicability).toBe('different_preparation');
  });
});
