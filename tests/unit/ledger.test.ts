import { describe, expect, it } from 'vitest';
import { assessApplicability, evaluate, gradeEvidence, inputsHash, samePreparation } from '@/lib/ledger/engine';
import { botanical, catalogue, input, product, study } from '../helpers/catalogue';

const find = (d: ReturnType<typeof evaluate>, id: string) => d.products.find((p) => p.productId === id)!;

describe('evidence strength (E1)', () => {
  const goal = 'calm_visible_redness' as const;
  const out = (finding: 'supports' | 'no_effect' | 'mixed') => [{ goal, measure: 'm', finding, summary: 's' }];

  it('grades one supporting RCT as moderate and two as strong', () => {
    expect(gradeEvidence([study('a')], goal)).toBe('moderate');
    expect(gradeEvidence([study('a'), study('a')], goal)).toBe('strong');
  });
  it('counts a supporting systematic review as one trial', () => {
    expect(gradeEvidence([study('a', { design: 'systematic_review' })], goal)).toBe('moderate');
    expect(gradeEvidence([study('a', { design: 'systematic_review' }), study('a')], goal)).toBe('strong');
  });
  it('caps the grade at moderate when a systematic review does not support it', () => {
    expect(gradeEvidence([study('a'), study('a'), study('a', { design: 'systematic_review', outcomes: out('mixed') })], goal)).toBe('moderate');
  });
  it('treats trials of whole multi-ingredient products and acute models as limited', () => {
    expect(gradeEvidence([study('a', { isolatesBotanical: false }), study('a', { isolatesBotanical: false })], goal)).toBe('limited');
    expect(gradeEvidence([study('a', { setting: 'acute_model' })], goal)).toBe('limited');
  });
  it('does not count medical-setting studies towards a cosmetic grade', () => {
    expect(gradeEvidence([study('a', { setting: 'medical' }), study('a', { setting: 'medical' })], goal)).toBe('none');
    expect(gradeEvidence([study('a', { setting: 'medical' }), study('a', { design: 'open_label' })], goal)).toBe('limited');
  });
  it('calls RCTs on both sides conflicting, not an average', () => {
    expect(gradeEvidence([study('a'), study('a', { outcomes: out('no_effect') })], goal)).toBe('conflicting');
  });
  it('grades non-randomised human support as limited', () => {
    expect(gradeEvidence([study('a', { design: 'open_label', randomised: false })], goal)).toBe('limited');
    expect(gradeEvidence([study('a', { design: 'split_face' })], goal)).toBe('limited');
  });
  it('grades a null RCT with no support as not supported', () => {
    expect(gradeEvidence([study('a', { outcomes: out('no_effect') })], goal)).toBe('not_supported');
  });
  it('grades lab-only support as preclinical', () => {
    expect(gradeEvidence([study('a', { design: 'in_vitro' })], goal)).toBe('preclinical');
  });
  it('ignores studies that measured a different goal', () => {
    expect(gradeEvidence([study('a')], 'balance_oil')).toBe('none');
  });
});

describe('formulation applicability (A1)', () => {
  const ing = (concentration: { percent: number; wording: string } | null = null) => ({
    inci: 'Testus a Leaf Extract',
    botanicalId: 'a',
    preparation: { part: 'leaf' as const, form: 'extract' as const, compound: null },
    concentration,
  });

  it('never infers concentration: an unstated amount is unknown', () => {
    const r = assessApplicability(ing(), 'leave_on', [study('a', { concentration: { percent: 2, wording: '2%' } })], false);
    expect(r.applicability).toBe('concentration_unknown');
  });
  it('is a close match when the stated amount is at least what was studied', () => {
    const r = assessApplicability(ing({ percent: 2, wording: '2%' }), 'leave_on', [study('a', { concentration: { percent: 1, wording: '1%' } })], false);
    expect(r.applicability).toBe('close_match');
  });
  it('is weaker when the stated amount is lower than studied', () => {
    const r = assessApplicability(ing({ percent: 0.5, wording: '0.5%' }), 'leave_on', [study('a', { concentration: { percent: 1, wording: '1%' } })], false);
    expect(r.applicability).toBe('weaker_match');
  });
  it('is weaker when a leave-on study backs a rinse-off product', () => {
    const r = assessApplicability(ing({ percent: 5, wording: '5%' }), 'rinse_off', [study('a', { concentration: { percent: 5, wording: '5%' } })], false);
    expect(r.applicability).toBe('weaker_match');
    expect(r.reasons.join(' ')).toMatch(/rinsed off/);
  });
  it('treats a different part, form or an isolated compound as a different preparation', () => {
    const leaf = { part: 'leaf' as const, form: 'extract' as const, compound: null };
    expect(samePreparation(leaf, { part: 'seed', form: 'extract', compound: null }).matches).toBe(false);
    expect(samePreparation(leaf, { part: 'leaf', form: 'oil', compound: null }).matches).toBe(false);
    expect(samePreparation(leaf, { part: 'leaf', form: 'isolated_compound', compound: 'madecassoside' }).matches).toBe(false);
    expect(samePreparation({ part: 'unspecified', form: 'isolated_compound', compound: 'Madecassoside' }, { part: 'leaf', form: 'isolated_compound', compound: 'madecassoside' }).matches).toBe(true);
  });
  it('flags an unconfirmed plant part and never calls it a close match', () => {
    const m = samePreparation({ part: 'unspecified', form: 'extract', compound: null }, { part: 'leaf', form: 'extract', compound: null });
    expect(m).toEqual({ matches: true, partUnconfirmed: true });
    const r = assessApplicability(ing({ percent: 5, wording: '5%' }), 'leave_on', [study('a', { concentration: { percent: 1, wording: '1%' } })], true);
    expect(r.applicability).toBe('concentration_unknown');
  });
});

describe('hard exclusions (X)', () => {
  it('excludes a product with the strongest evidence when it breaks a constraint', () => {
    const cat = catalogue({
      studies: [study('a'), study('a'), study('a', { design: 'systematic_review' })],
      products: [product('p1', { ingredientsVerbatim: 'Aqua, Testus a Leaf Extract, Parfum (Fragrance)' })],
    });
    const free = evaluate(cat, input());
    expect(find(free, 'p1').outcome).toBe('eligible');
    const d = evaluate(cat, input({ constraints: { ...input().constraints, noFragrance: true } }));
    const p = find(d, 'p1');
    expect(p.outcome).toBe('excluded');
    expect(p.rankKey).toBeNull();
    expect(d.shortlist).not.toContain('p1');
    expect(p.factors[0]).toMatchObject({ rule: 'X1_fragrance', effect: 'excludes', ingredient: 'Parfum (Fragrance)' });
    expect(d.status).toBe('no_match');
  });

  it('applies each constraint type and names the ingredient', () => {
    const verbatim = 'Aqua, Testus a Leaf Extract, Lavandula Angustifolia (Lavender) Oil, Linalool, Calendula Officinalis Flower Extract, Alcohol Denat.';
    const cat = catalogue({ products: [product('p1', { ingredientsVerbatim: verbatim })] });
    const base = input().constraints;
    const rule = (c: Partial<typeof base>) => find(evaluate(cat, input({ constraints: { ...base, ...c } })), 'p1').factors.map((f) => [f.rule, f.ingredient]);
    expect(rule({ noEssentialOils: true })).toEqual([['X2_essential_oils', 'Lavandula Angustifolia (Lavender) Oil']]);
    expect(rule({ noFragranceAllergens: true })).toEqual([['X3_fragrance_allergens', 'Linalool']]);
    expect(rule({ avoidAsteraceae: true })).toEqual([['X4_asteraceae', 'Calendula Officinalis Flower Extract']]);
    expect(rule({ avoidIngredients: ['alcohol denat'] })).toEqual([['X5_named_ingredient', 'Alcohol Denat.']]);
  });

  it('cannot confirm exclusions for an unverified product and never recommends it', () => {
    const cat = catalogue({ products: [product('p1', { verification: 'unverified', ingredientsVerbatim: null })] });
    const p = find(evaluate(cat, input({ constraints: { ...input().constraints, noFragrance: true } })), 'p1');
    expect(p.outcome).toBe('unverified');
    expect(p.factors[0]!.message).toMatch(/cannot be confirmed/);
    expect(find(evaluate(cat, input()), 'p1').outcome).toBe('unverified');
  });
});

describe('eligibility outcomes', () => {
  it('sets aside a product whose only evidence is preclinical', () => {
    const cat = catalogue({ studies: [study('a', { design: 'in_vitro' })] });
    const p = find(evaluate(cat, input()), 'p1');
    expect(p.outcome).toBe('limited_evidence');
    expect(p.factors.some((f) => f.rule === 'Q1_qualifying_link' && f.effect === 'blocks')).toBe(true);
  });

  it('sets aside a product when the evidence is for a different preparation', () => {
    const cat = catalogue({ studies: [study('a'), study('a')], products: [product('p1', { botanicals: [{ inci: 'Testus a Seed Oil', botanicalId: 'a', preparation: { part: 'seed', form: 'oil', compound: null }, concentration: null }], ingredientsVerbatim: 'Testus a Seed Oil' })] });
    const p = find(evaluate(cat, input()), 'p1');
    expect(p.outcome).toBe('limited_evidence');
    expect(p.goals[0]!.applicability).toBe('different_preparation');
    expect(p.goals[0]!.otherPreparationStudies.length).toBe(2);
  });

  it('marks a product with no link to the goals as not relevant', () => {
    expect(find(evaluate(catalogue(), input({ goals: ['balance_oil'] })), 'p1').outcome).toBe('not_relevant');
  });

  it('lists a partly verified product only with a caution', () => {
    const cat = catalogue({ products: [product('p1', { verification: 'partial', verificationNote: 'US and Canadian labels differ.' })] });
    const p = find(evaluate(cat, input()), 'p1');
    expect(p.outcome).toBe('caution');
    expect(p.factors.find((f) => f.rule === 'V2_partial')?.message).toBe('US and Canadian labels differ.');
  });

  it('adds reactive-skin and safety cautions without excluding', () => {
    const cat = catalogue({
      botanicals: [botanical('a', { safetyNotes: [{ note: 'Can cause contact allergy.', source: { title: 'src', url: 'https://example.org/n' } }] })],
      products: [product('p1', { ingredientsVerbatim: 'Aqua, Testus a Leaf Extract, Limonene' })],
    });
    expect(find(evaluate(cat, input()), 'p1').outcome).toBe('eligible');
    const p = find(evaluate(cat, input({ reactiveSkin: true })), 'p1');
    expect(p.outcome).toBe('caution');
    expect(p.factors.filter((f) => f.effect === 'cautions').map((f) => f.rule).sort()).toEqual(['C1_reactive_skin', 'C3_safety_note']);
  });

  it('returns an honest no-match with counts when nothing qualifies', () => {
    const d = evaluate(catalogue({ studies: [study('a', { design: 'animal' })] }), input());
    expect(d.status).toBe('no_match');
    expect(d.shortlist).toEqual([]);
    expect(d.counts.limited_evidence).toBe(1);
  });

  it('ignores colour-shelf products', () => {
    const d = evaluate(catalogue({ products: [product('lip', { shelf: 'colour', category: 'lip' })] }), input());
    expect(d.products).toEqual([]);
  });
});

describe('ranking (K1)', () => {
  const twoGoalCat = () =>
    catalogue({
      studies: [study('a'), study('b', { outcomes: [{ goal: 'support_hydration', measure: 'm', finding: 'supports', summary: 's' }] })],
      products: [
        product('one-goal'),
        product('two-goals', {
          ingredientsVerbatim: 'Aqua, Testus a Leaf Extract, Testus b Leaf Extract',
          botanicals: [
            { inci: 'Testus a Leaf Extract', botanicalId: 'a', preparation: { part: 'leaf', form: 'extract', compound: null }, concentration: null },
            { inci: 'Testus b Leaf Extract', botanicalId: 'b', preparation: { part: 'leaf', form: 'extract', compound: null }, concentration: null },
          ],
        }),
      ],
    });

  it('ranks by goals backed by moderate evidence first', () => {
    const d = evaluate(twoGoalCat(), input({ goals: ['calm_visible_redness', 'support_hydration'] }));
    expect(d.shortlist).toEqual(['two-goals', 'one-goal']);
  });

  it('puts cautioned products after uncautioned ones', () => {
    const cat = twoGoalCat();
    cat.products[1]!.ingredientsVerbatim += ', Linalool';
    const d = evaluate(cat, input({ goals: ['calm_visible_redness', 'support_hydration'], reactiveSkin: true }));
    expect(d.shortlist).toEqual(['one-goal', 'two-goals']);
  });

  it('lets a preference only break ties, and reports ties', () => {
    const cat = catalogue({ products: [product('zeta', { category: 'serum' }), product('alpha')] });
    const tied = evaluate(cat, input());
    expect(tied.shortlist).toEqual(['alpha', 'zeta']);
    expect(find(tied, 'alpha').tiedWith).toEqual(['zeta']);
    const pref = evaluate(cat, input({ preferredCategories: ['serum'] }));
    expect(pref.shortlist).toEqual(['zeta', 'alpha']);
    expect(find(pref, 'alpha').tiedWith).toEqual([]);
  });

  it('cannot use a preference to outrank stronger evidence', () => {
    const cat = catalogue({
      studies: [study('a'), study('b', { design: 'open_label' })],
      products: [
        product('strong'),
        product('weak-serum', { category: 'serum', ingredientsVerbatim: 'Testus b Leaf Extract', botanicals: [{ inci: 'Testus b Leaf Extract', botanicalId: 'b', preparation: { part: 'leaf', form: 'extract', compound: null }, concentration: null }] }),
      ],
    });
    // Same goal for both botanicals.
    cat.studies[1]!.outcomes = [{ goal: 'calm_visible_redness', measure: 'm', finding: 'supports', summary: 's' }];
    expect(evaluate(cat, input({ preferredCategories: ['serum'] })).shortlist).toEqual(['strong', 'weak-serum']);
  });
});

describe('reproducibility', () => {
  it('gives the same decision for the same inputs in any order', () => {
    const cat = catalogue({ products: [product('b'), product('a')] });
    const i1 = input({ goals: ['support_hydration', 'calm_visible_redness'], constraints: { ...input().constraints, avoidIngredients: ['Lanolin', 'alcohol denat'] } });
    const i2 = input({ goals: ['calm_visible_redness', 'support_hydration'], constraints: { ...input().constraints, avoidIngredients: ['Alcohol Denat', 'lanolin'] } });
    expect(inputsHash(i1)).toBe(inputsHash(i2));
    const strip = (d: ReturnType<typeof evaluate>) => ({ ...d, evaluatedAt: '' });
    expect(strip(evaluate(cat, i1))).toEqual(strip(evaluate(cat, i2)));
  });

  it('changes the catalogue version when a record changes', () => {
    const a = evaluate(catalogue(), input());
    const cat = catalogue();
    cat.products[0]!.name = 'Renamed';
    expect(evaluate(cat, input()).catalogueVersion).not.toBe(a.catalogueVersion);
  });
});
