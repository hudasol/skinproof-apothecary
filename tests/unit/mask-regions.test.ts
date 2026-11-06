import { describe, expect, it } from 'vitest';
import { describeRegions, measureMask } from '@/lib/domain/mask-regions';
import { readScores, standingWords } from '@/lib/domain/reading';

function mask(w: number, h: number, on: (x: number, y: number) => boolean): Uint8Array {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = on(x, y) ? 255 : 0;
  return d;
}

describe('measureMask', () => {
  it('finds a patch in the upper left and describes it', () => {
    const m = measureMask(mask(60, 60, (x, y) => x < 15 && y < 15), 60, 60)!;
    expect(m.bands.upper).toBe(1);
    expect(m.sides.left).toBe(1);
    expect(m.coveragePercent).toBeCloseTo(6.25, 1);
    expect(describeRegions(m)).toMatch(/forehead.*left of the photo/);
  });
  it('reports nothing for an empty mask and null for a fully opaque one', () => {
    expect(measureMask(mask(30, 30, () => false), 30, 30)!.coveragePercent).toBe(0);
    expect(measureMask(mask(30, 30, () => true), 30, 30)).toBeNull();
  });
});

describe('readScores', () => {
  it('measures each score against the person’s own average', () => {
    const r = readScores({
      scores: [
        { concern: 'moisture', rawScore: 40, uiScore: null, maskArtifactId: null },
        { concern: 'pore', rawScore: 70, uiScore: null, maskArtifactId: null },
        { concern: 'redness', rawScore: 70, uiScore: null, maskArtifactId: null },
      ],
      skinType: {},
      missing: [],
      ignoredTypes: [],
    });
    expect(r.average).toBe(60);
    expect(r.lowest?.concern).toBe('moisture');
    expect(r.lowest?.standing).toBe('lower');
    expect(standingWords(r.lowest!)).toBe('20 points below your average');
    expect(r.scores[1]!.standing).toBe('higher');
  });
});
