import { SCORED_CONCERNS, type ConcernScore, type ScoredConcern, type SkinAnalysisResult } from './skin';

/**
 * Plain language reading aids for an analysis. YouCam publishes no cut off for
 * a good or a poor score, so everything here is relative to the person's own
 * other scores in the same analysis. Nothing here is a clinical judgement.
 */

/** A score this far (in points) from the person's own average counts as clearly lower or higher. */
export const NOTICEABLE_GAP = 8;

export type Standing = 'lower' | 'near' | 'higher';

export type ReadScore = ConcernScore & { delta: number; standing: Standing };

export type Reading = {
  average: number;
  scores: ReadScore[];
  lowest: ReadScore | null;
  highest: ReadScore | null;
  /** Spread between the highest and the lowest score, in points. */
  spread: number;
};

export function readScores(result: SkinAnalysisResult): Reading {
  const scores = result.scores;
  if (!scores.length) return { average: 0, scores: [], lowest: null, highest: null, spread: 0 };
  const average = scores.reduce((sum, s) => sum + s.rawScore, 0) / scores.length;
  const order = (c: ScoredConcern) => SCORED_CONCERNS.indexOf(c);
  const read: ReadScore[] = scores
    .map((s) => {
      const delta = s.rawScore - average;
      const standing: Standing = delta <= -NOTICEABLE_GAP ? 'lower' : delta >= NOTICEABLE_GAP ? 'higher' : 'near';
      return { ...s, delta, standing };
    })
    .sort((a, b) => a.rawScore - b.rawScore || order(a.concern) - order(b.concern));
  return { average, scores: read, lowest: read[0]!, highest: read[read.length - 1]!, spread: read[read.length - 1]!.rawScore - read[0]!.rawScore };
}

export function standingWords(s: ReadScore): string {
  const points = Math.abs(Math.round(s.delta));
  if (s.standing === 'near') return 'close to your average';
  return `${points} point${points === 1 ? '' : 's'} ${s.standing === 'lower' ? 'below' : 'above'} your average`;
}
