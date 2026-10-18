import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { getCatalogue } from '../catalogue';
import type { Db } from '../db/client';
import { decisions, type Decision } from '../db/schema';
import { newId } from '../domain/ids';
import { catalogueVersion, evaluate, inputsHash } from '../ledger/engine';
import { RULE_VERSION } from '../ledger/rules';
import type { LedgerInput } from '../ledger/types';
import { latestAnalysis } from './analyses';
import { requireConsultation } from './consultations';
import { AppError } from './errors';

/**
 * Runs the Ledger for a consultation and records the decision with its
 * provenance: rule version, catalogue version and a hash of the inputs. The
 * same inputs, catalogue and rules return the stored decision instead of
 * writing a new one, so decisions are reproducible and auditable.
 */

export function latestDecision(db: Db, consultationId: string): Decision | undefined {
  return db.select().from(decisions).where(eq(decisions.consultationId, consultationId)).orderBy(desc(decisions.createdAt)).get();
}

export function decide(db: Db, consultationId: string): Decision {
  const c = requireConsultation(db, consultationId);
  if (!c.profile) throw new AppError('invalid_input', 'Choose your goals first.');
  const input: LedgerInput = {
    goals: c.profile.goals,
    constraints: c.profile.constraints,
    reactiveSkin: c.profile.reactiveSkin,
    preferredCategories: c.profile.preferredCategories,
  };
  const catalogue = getCatalogue();
  const hash = inputsHash(input);
  const version = catalogueVersion(catalogue);
  const previous = latestDecision(db, consultationId);
  if (previous && previous.inputsHash === hash && previous.catalogueVersion === version && previous.ruleVersion === RULE_VERSION) {
    return previous;
  }
  const analysis = latestAnalysis(db, consultationId);
  const decision = evaluate(catalogue, input, {
    analysisId: analysis?.status === 'succeeded' ? analysis.id : null,
    goalOrigins: c.profile.goalOrigins,
  });
  const row: Decision = {
    id: newId('decision'),
    consultationId,
    analysisId: decision.analysisId,
    ruleVersion: decision.ruleVersion,
    catalogueVersion: decision.catalogueVersion,
    inputsHash: decision.inputsHash,
    decision,
    createdAt: new Date(),
  };
  db.insert(decisions).values(row).run();
  return row;
}
