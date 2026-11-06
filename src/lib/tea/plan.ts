import { GOALS, type Goal } from '../domain/skin';
import type { Tea, TeaTier } from '../catalogue/tea-schema';

/**
 * Which herbal teas to suggest for the goals a person is working on, and one
 * blend that covers as many of them as the evidence allows. Deterministic: the
 * same goals and limits always give the same answer.
 *
 * Rules, in order:
 *  1. A tea is left out for a person who avoids daisy family plants and the tea is one.
 *  2. A tea that was tested and did not help is shown, never blended.
 *  3. A tea marked not for blending is shown, never blended.
 *  4. The blend is built greedily: the tea covering the most uncovered goals,
 *     counting a human trial as 2 and traditional use as 1, until every goal is
 *     covered or four teas are chosen. Ties go to the tea listed first.
 */

export type TeaLimits = { avoidDaisyFamily: boolean };

export type GoalOption = { tea: Tea; tier: TeaTier; headline: string; detail: string; evidenceIds: string[]; sources: { title: string; url: string }[] };

export type GoalPlan = {
  goal: Goal;
  options: GoalOption[];
  /** Teas that would have been listed but break a limit. */
  excluded: { tea: Tea; reason: string }[];
};

export type BlendPart = { tea: Tea; covers: { goal: Goal; tier: TeaTier }[] };

export type TeaPlan = {
  goals: GoalPlan[];
  blend: BlendPart[];
  /** Goals the blend does not cover, with the reason. */
  uncovered: { goal: Goal; reason: string }[];
};

export const MAX_BLEND = 4;
const TIER_ORDER: Record<TeaTier, number> = { human_trial: 0, traditional: 1, tested_not_helpful: 2 };
const WEIGHT: Record<TeaTier, number> = { human_trial: 2, traditional: 1, tested_not_helpful: 0 };

export function planTea(teas: Tea[], goals: Goal[], limits: TeaLimits): TeaPlan {
  const wanted = GOALS.filter((g) => goals.includes(g));
  const plans: GoalPlan[] = wanted.map((goal) => {
    const options: GoalOption[] = [];
    const excluded: GoalPlan['excluded'] = [];
    for (const tea of teas) {
      const entry = tea.goals.find((g) => g.goal === goal);
      if (!entry) continue;
      if (limits.avoidDaisyFamily && tea.daisyFamily) {
        excluded.push({ tea, reason: 'It is a daisy family plant, and you said you avoid that family.' });
        continue;
      }
      options.push({ tea, tier: entry.tier, headline: entry.headline, detail: entry.detail, evidenceIds: entry.evidenceIds, sources: entry.sources });
    }
    options.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || teas.indexOf(a.tea) - teas.indexOf(b.tea));
    return { goal, options, excluded };
  });

  const blend: BlendPart[] = [];
  const covered = new Set<Goal>();
  while (blend.length < MAX_BLEND) {
    let best: { tea: Tea; score: number; covers: BlendPart['covers'] } | null = null;
    for (const tea of teas) {
      if (!tea.blend.eligible || blend.some((b) => b.tea.id === tea.id)) continue;
      if (limits.avoidDaisyFamily && tea.daisyFamily) continue;
      const covers = tea.goals.filter((g) => wanted.includes(g.goal) && !covered.has(g.goal) && WEIGHT[g.tier] > 0).map((g) => ({ goal: g.goal, tier: g.tier }));
      const score = covers.reduce((n, c) => n + WEIGHT[c.tier], 0);
      if (score > 0 && (!best || score > best.score)) best = { tea, score, covers };
    }
    if (!best) break;
    blend.push({ tea: best.tea, covers: best.covers });
    for (const c of best.covers) covered.add(c.goal);
    if (wanted.every((g) => covered.has(g))) break;
  }
  // A tea already chosen may also cover a goal that was covered first by another; show every goal it serves.
  for (const part of blend) {
    part.covers = part.tea.goals.filter((g) => wanted.includes(g.goal) && WEIGHT[g.tier] > 0).map((g) => ({ goal: g.goal, tier: g.tier }));
  }

  const uncovered = wanted
    .filter((g) => !covered.has(g))
    .map((goal) => {
      const plan = plans.find((p) => p.goal === goal)!;
      const reason = plan.options.length === 0
        ? plan.excluded.length
          ? 'The only teas for this goal break a limit you set.'
          : 'No herbal tea has been tested or traditionally used for this goal in the sources we reviewed. The botanical library and your shortlist cover it better.'
        : 'The teas listed for this goal either did not help in trials or are not suitable for a blend, so none is added.';
      return { goal, reason };
    });
  return { goals: plans, blend, uncovered };
}
