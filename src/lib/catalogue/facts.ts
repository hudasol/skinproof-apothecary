import { EMPTY_CONSTRAINTS } from '../domain/profile';
import { GOALS, type Goal } from '../domain/skin';
import { countedStudies, evaluate, gradeEvidence } from '../ledger/engine';
import type { EvidenceGrade } from '../ledger/types';
import type { Catalogue, Preparation, Study } from './schema';

/** Plain-language name for a preparation, e.g. "leaf extract", "madecassoside", "colloidal oatmeal". */
export function preparationLabel(p: Preparation): string {
  if (p.compound) return p.compound;
  const part = p.part === 'unspecified' ? '' : p.part === 'aerial_parts' ? 'aerial parts' : p.part.replace('_', ' ');
  const form = {
    extract: 'extract',
    oil: 'oil',
    juice_or_gel: 'juice or gel',
    colloidal_flour: 'colloidal oatmeal',
    distillate: 'distillate',
    isolated_compound: 'compound',
    unspecified: 'preparation',
  }[p.form];
  if (p.form === 'colloidal_flour') return form;
  return part ? `${part} ${form}` : form === 'extract' ? 'extract (part not stated)' : form;
}

export type PreparationEvidence = {
  preparation: Preparation;
  label: string;
  goals: { goal: Goal; grade: EvidenceGrade; studies: Study[] }[];
};

/** Evidence for one botanical, grouped by preparation then goal, graded by the Ledger's own rule. */
export function evidenceByPreparation(cat: Catalogue, botanicalId: string): PreparationEvidence[] {
  const studies = cat.studies.filter((s) => s.botanicalId === botanicalId);
  const key = (p: Preparation) => (p.compound ? `c:${p.compound.toLowerCase()}` : `${p.form}:${p.part}`);
  const groups = new Map<string, PreparationEvidence & { members: Study[] }>();
  for (const s of studies) {
    const k = key(s.preparation);
    if (!groups.has(k)) groups.set(k, { preparation: s.preparation, label: preparationLabel(s.preparation), goals: [], members: [] });
    groups.get(k)!.members.push(s);
  }
  for (const g of groups.values()) {
    const inGroup = g.members;
    for (const goal of GOALS) {
      const forGoal = inGroup.filter((s) => s.outcomes.some((o) => o.goal === goal));
      if (forGoal.length) g.goals.push({ goal, grade: gradeEvidence(forGoal, goal), studies: forGoal });
    }
  }
  return [...groups.values()].map(({ members: _members, ...rest }) => rest);
}

export function botanicalCounts(cat: Catalogue, botanicalId: string) {
  const studies = cat.studies.filter((s) => s.botanicalId === botanicalId);
  const human = studies.filter((s) => !['in_vitro', 'animal'].includes(s.design));
  const isolatingTrials = studies.filter((s) => s.design === 'rct' && s.setting === 'cosmetic' && s.isolatesBotanical);
  return { studies: studies.length, human: human.length, counted: GOALS.reduce((n, g) => Math.max(n, countedStudies(studies, g).length), 0), isolatingTrials: isolatingTrials.length };
}

/** Headline facts about the catalogue, computed, never typed in. */
export function catalogueFacts(cat: Catalogue) {
  const skincare = cat.products.filter((p) => p.shelf === 'skincare');
  const all = evaluate(cat, { goals: [...GOALS], constraints: EMPTY_CONSTRAINTS, reactiveSkin: false, preferredCategories: [] });
  const qualifying = all.products.filter((p) => p.outcome === 'eligible' || p.outcome === 'caution').length;
  const statedAmount = skincare.filter((p) => p.botanicals.some((b) => b.concentration) || p.actives.length).length;
  return {
    botanicals: cat.botanicals.length,
    studies: cat.studies.length,
    medical: cat.studies.filter((s) => s.setting === 'medical').length,
    isolatingTrials: cat.studies.filter((s) => s.design === 'rct' && s.setting === 'cosmetic' && s.isolatesBotanical).length,
    wholeProductStudies: cat.studies.filter((s) => !s.isolatesBotanical).length,
    skincare: skincare.length,
    traced: skincare.filter((p) => p.verification !== 'unverified').length,
    qualifying,
    statedAmount,
    colour: cat.products.filter((p) => p.shelf === 'colour').length,
  };
}
