import 'server-only';
import type { Db } from './db/client';
import type { Consultation } from './db/schema';
import type { StepKey } from '@/components/ConsultSteps';
import { latestAnalysis } from './services/analyses';
import { currentPhoto } from './services/consultations';
import { latestDecision } from './services/decisions';

/** Which consultation steps are complete, for the step indicator. */
export function completedSteps(db: Db, c: Consultation | null): StepKey[] {
  if (!c) return [];
  const done: StepKey[] = [];
  if (c.analysisConsentAt || c.previewConsentAt) done.push('consent');
  if (currentPhoto(db, c.id) || latestAnalysis(db, c.id)) done.push('photo');
  if (latestAnalysis(db, c.id)?.status === 'succeeded') done.push('analysis');
  if (c.profile) done.push('goals');
  if (latestDecision(db, c.id)) done.push('shortlist');
  return done;
}
