import { describe, expect, it } from 'vitest';
import { suggestFocus, type SkinAnalysisResult } from '@/lib/domain/skin';

const result = (scores: Record<string, number>): SkinAnalysisResult => ({
  scores: Object.entries(scores).map(([concern, rawScore]) => ({ concern: concern as never, rawScore, uiScore: null, maskArtifactId: null })),
  skinType: {},
  missing: [],
  ignoredTypes: [],
});

describe('suggestFocus', () => {
  it('suggests the lowest raw scores relative to the person’s own results', () => {
    const s = suggestFocus(result({ redness: 80, moisture: 40, oiliness: 55, texture: 90, acne: 70 }));
    expect(s.map((x) => x.goal)).toEqual(['support_hydration', 'balance_oil', 'blemish_care']);
  });

  it('gives one suggestion per goal when two concerns share it', () => {
    const s = suggestFocus(result({ texture: 30, pore: 20, moisture: 50 }), 3);
    expect(s.map((x) => [x.goal, x.concern])).toEqual([
      ['refine_texture', 'pore'],
      ['support_hydration', 'moisture'],
    ]);
  });

  it('skips concerns the catalogue cannot address', () => {
    expect(suggestFocus(result({ dark_circle_v2: 5, redness: 60 })).map((x) => x.concern)).toEqual(['redness']);
  });

  it('breaks ties by the fixed concern order', () => {
    expect(suggestFocus(result({ acne: 50, redness: 50 }), 1)[0]!.concern).toBe('redness');
  });
});
