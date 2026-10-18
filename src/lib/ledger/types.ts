import type { Constraints, ProductCategory } from '../domain/profile';
import type { Goal } from '../domain/skin';

/**
 * Evidence strength: how much human research supports a botanical
 * *preparation* for a cosmetic outcome. Ordinal categories, not scores.
 */
export type EvidenceGrade = 'strong' | 'moderate' | 'limited' | 'conflicting' | 'not_supported' | 'preclinical' | 'none';

/**
 * Formulation applicability: how closely a product's ingredient matches what
 * was studied (preparation, concentration, leave-on vs rinse-off).
 */
export type Applicability = 'close_match' | 'concentration_unknown' | 'weaker_match' | 'different_preparation';

/** Product eligibility: the outcome of the selection policy for one product. */
export type Outcome = 'eligible' | 'caution' | 'excluded' | 'unverified' | 'limited_evidence' | 'not_relevant';

export type RuleId =
  | 'X1_fragrance'
  | 'X2_essential_oils'
  | 'X3_fragrance_allergens'
  | 'X4_asteraceae'
  | 'X5_named_ingredient'
  | 'V1_unverified'
  | 'V2_partial'
  | 'V3_source_conflict'
  | 'R1_relevance'
  | 'E1_grade'
  | 'A1_applicability'
  | 'Q1_qualifying_link'
  | 'C1_reactive_skin'
  | 'C2_conflicting_evidence'
  | 'C3_safety_note'
  | 'K1_rank';

export type Factor = {
  rule: RuleId;
  /** What this factor did to the outcome. */
  effect: 'excludes' | 'blocks' | 'qualifies' | 'cautions' | 'informs' | 'ranks';
  message: string;
  goal?: Goal;
  /** The label ingredient involved, when there is one. */
  ingredient?: string;
  /** Study ids or source URLs behind this factor. */
  sources?: string[];
};

export type GoalAssessment = {
  goal: Goal;
  botanicalId: string;
  /** The ingredient as it appears on the product label. */
  inci: string;
  grade: EvidenceGrade;
  /** Studies the grade was computed from (same preparation as the product's ingredient). */
  gradeBasis: string[];
  /** Studies of the same plant in other preparations, not used for the grade. */
  otherPreparationStudies: string[];
  applicability: Applicability;
  applicabilityReasons: string[];
  /** Human evidence on a matching preparation: counts towards eligibility. */
  qualifies: boolean;
};

export type ProductAssessment = {
  productId: string;
  outcome: Outcome;
  factors: Factor[];
  /** Best assessment per goal the person chose (only goals with any evidence link appear). */
  goals: GoalAssessment[];
  /** Lexicographic rank key, compared element by element; null if not ranked. */
  rankKey: number[] | null;
  rank: number | null;
  /** Products with an identical rank key: their order is alphabetical, not a judgement. */
  tiedWith: string[];
};

export type LedgerInput = {
  goals: Goal[];
  constraints: Constraints;
  reactiveSkin: boolean;
  preferredCategories: ProductCategory[];
};

export type LedgerDecision = {
  ruleVersion: string;
  catalogueVersion: string;
  inputsHash: string;
  input: LedgerInput;
  /** Where each goal came from, carried for provenance only; it does not affect the outcome. */
  goalOrigins: Partial<Record<Goal, 'analysis' | 'person'>>;
  analysisId: string | null;
  products: ProductAssessment[];
  shortlist: string[];
  status: 'shortlist' | 'no_match';
  counts: Record<Outcome, number>;
  evaluatedAt: string;
};

/** Constraint check for a colour product shade (no efficacy claims are made for colour). */
export type ColourCheck = {
  productId: string;
  shadeId: string;
  outcome: 'passes' | 'excluded' | 'unverified';
  factors: Factor[];
};
