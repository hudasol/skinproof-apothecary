import 'server-only';
import { getCatalogueVersion } from './catalogue';
import { getDb } from './db/client';
import type { Consultation, Decision } from './db/schema';
import { inputsHash } from './ledger/engine';
import { RULE_VERSION } from './ledger/rules';
import type { ProductAssessment } from './ledger/types';
import { latestDecision } from './services/decisions';
import { currentConsultation } from './session';

/**
 * The current visitor's consultation and their latest decision, for
 * read-only pages. A decision is shown only if it still matches the
 * person's current choices, catalogue and rules; otherwise /shortlist
 * re-runs the Ledger.
 */
export async function personalContext(): Promise<{ consultation: Consultation | null; decision: Decision | null }> {
  const consultation = await currentConsultation(getDb());
  if (!consultation?.profile) return { consultation, decision: null };
  const decision = latestDecision(getDb(), consultation.id) ?? null;
  const p = consultation.profile;
  const current =
    decision &&
    decision.inputsHash === inputsHash({ goals: p.goals, constraints: p.constraints, reactiveSkin: p.reactiveSkin, preferredCategories: p.preferredCategories }) &&
    decision.catalogueVersion === getCatalogueVersion() &&
    decision.ruleVersion === RULE_VERSION;
  return { consultation, decision: current ? decision : null };
}

export function assessmentFor(decision: Decision | null, productId: string): ProductAssessment | null {
  return decision?.decision.products.find((p) => p.productId === productId) ?? null;
}
