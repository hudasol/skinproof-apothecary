import type { Applicability, EvidenceGrade, Outcome, RuleId } from './ledger/types';
import type { Study } from './catalogue/schema';

/** One vocabulary for the whole interface: each state has one name everywhere. */

export const OUTCOME_LABEL: Record<Outcome, string> = {
  eligible: 'Eligible for consideration',
  caution: 'Eligible, with a caution',
  excluded: 'Excluded by your choices',
  unverified: 'Unverified product information',
  limited_evidence: 'Limited evidence',
  not_relevant: 'Not linked to your goals',
};

export const OUTCOME_SHORT: Record<Outcome, string> = {
  eligible: 'Eligible',
  caution: 'Caution',
  excluded: 'Excluded',
  unverified: 'Unverified',
  limited_evidence: 'Limited evidence',
  not_relevant: 'Not linked',
};

export const GRADE_LABEL: Record<EvidenceGrade, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  limited: 'Limited',
  conflicting: 'Conflicting',
  not_supported: 'Not supported',
  preclinical: 'Lab only',
  none: 'None found',
};

export const GRADE_EXPLAIN: Record<EvidenceGrade, string> = {
  strong: 'Two or more randomised cosmetic trials that isolate this preparation support it, and none disagree.',
  moderate: 'One randomised cosmetic trial that isolates this preparation supports it.',
  limited: 'Supported only by non-randomised studies, short irritation tests, or trials of whole multi-ingredient products.',
  conflicting: 'Randomised trials disagree.',
  not_supported: 'Human studies looked and found no effect.',
  preclinical: 'Only cell or animal studies.',
  none: 'No counted human study measured this.',
};

/** Ordered for scales and legends, strongest first. */
export const GRADE_ORDERED: EvidenceGrade[] = ['strong', 'moderate', 'limited', 'conflicting', 'not_supported', 'preclinical', 'none'];

export const APPLICABILITY_LABEL: Record<Applicability, string> = {
  close_match: 'Close match',
  concentration_unknown: 'Amount not stated',
  weaker_match: 'Weaker match',
  different_preparation: 'Different preparation',
};

export const DESIGN_LABEL: Record<Study['design'], string> = {
  systematic_review: 'Systematic review',
  rct: 'Randomised trial',
  controlled_trial: 'Controlled study',
  split_face: 'Split-face study',
  open_label: 'Open study, no control',
  in_vitro: 'Cell study',
  animal: 'Animal study',
};

export const SETTING_LABEL: Record<Study['setting'], string> = {
  cosmetic: 'Everyday cosmetic use',
  acute_model: 'Short irritation test',
  medical: 'Medical setting (not counted)',
};

export const STAGE_OF_RULE: Record<RuleId, number> = {
  X1_fragrance: 1,
  X2_essential_oils: 1,
  X3_fragrance_allergens: 1,
  X4_asteraceae: 1,
  X5_named_ingredient: 1,
  V1_unverified: 2,
  V2_partial: 2,
  V3_source_conflict: 2,
  R1_relevance: 3,
  E1_grade: 4,
  A1_applicability: 4,
  Q1_qualifying_link: 5,
  C1_reactive_skin: 5,
  C2_conflicting_evidence: 5,
  C3_safety_note: 5,
  K1_rank: 6,
};

export const STAGES = [
  'Your exclusions',
  'Product information',
  'Relevance to your goals',
  'Evidence and formulation',
  'Eligibility and cautions',
  'Ranking',
] as const;

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}

export function citationShort(s: Study): string {
  return `${s.citation.authors.replace(/ et al\.?$/, '')} et al., ${s.citation.year}`;
}
