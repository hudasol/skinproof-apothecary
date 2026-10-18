import 'server-only';
import { and, eq, gte, notInArray, sum } from 'drizzle-orm';
import type { Db } from '../db/client';
import { analyses, previews } from '../db/schema';
import { getEnv } from '../env';
import { AppError } from './errors';

/**
 * Live spend guard. Units are estimated from the documented unit table and
 * counted for live tasks that succeeded or are still running today (UTC);
 * failed tasks are documented as free and are not counted.
 */

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function unitsUsedToday(db: Db, now = new Date()): number {
  const since = startOfUtcDay(now);
  const notFree = notInArray(analyses.status, ['failed', 'interrupted']);
  const a = db
    .select({ n: sum(analyses.unitsEstimated) })
    .from(analyses)
    .where(and(eq(analyses.providerMode, 'live'), gte(analyses.createdAt, since), notFree))
    .get();
  const p = db
    .select({ n: sum(previews.unitsEstimated) })
    .from(previews)
    .where(and(eq(previews.providerMode, 'live'), gte(previews.createdAt, since), notInArray(previews.status, ['failed', 'interrupted'])))
    .get();
  return Number(a?.n ?? 0) + Number(p?.n ?? 0);
}

export function assertWithinBudget(db: Db, units: number, now = new Date()): void {
  const budget = getEnv().liveDailyUnitBudget;
  const used = unitsUsedToday(db, now);
  if (used + units > budget) {
    throw new AppError(
      'budget_exceeded',
      `Live analysis is paused for today: this demo has used its daily YouCam unit budget (${used} of ${budget}). It resets at midnight UTC.`,
    );
  }
}
