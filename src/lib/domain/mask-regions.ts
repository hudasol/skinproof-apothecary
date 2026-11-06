/**
 * Describe where a detection mask lies, from its pixels. The mask is YouCam's
 * own output; this only measures it. Regions are thirds of the photo, which
 * for a face photo roughly means forehead, eyes to nose, and mouth to chin.
 */

export type MaskRegions = {
  /** Share of the image the mask covers, 0 to 100. */
  coveragePercent: number;
  /** Share of the detected area in each band, 0 to 1. */
  bands: { upper: number; middle: number; lower: number };
  sides: { left: number; right: number };
};

/** Raw RGBA bytes, row by row. Pixels with alpha above the threshold count as detected. */
export function measureMask(rgba: Uint8Array, width: number, height: number, alphaThreshold = 40): MaskRegions | null {
  if (width < 3 || height < 3 || rgba.length < width * height * 4) return null;
  let hit = 0;
  const bands = [0, 0, 0];
  const sides = [0, 0];
  for (let y = 0; y < height; y++) {
    const band = Math.min(2, Math.floor((y / height) * 3));
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3]! > alphaThreshold) {
        hit++;
        bands[band]!++;
        sides[x < width / 2 ? 0 : 1]!++;
      }
    }
  }
  if (!hit) return { coveragePercent: 0, bands: { upper: 0, middle: 0, lower: 0 }, sides: { left: 0, right: 0 } };
  const total = width * height;
  // A fully opaque mask carries no location information.
  if (hit / total > 0.97) return null;
  return {
    coveragePercent: (hit / total) * 100,
    bands: { upper: bands[0]! / hit, middle: bands[1]! / hit, lower: bands[2]! / hit },
    sides: { left: sides[0]! / hit, right: sides[1]! / hit },
  };
}

const BAND_WORDS = { upper: 'the upper face (forehead)', middle: 'the middle of the face (eyes, nose and cheeks)', lower: 'the lower face (mouth and chin)' } as const;

/** One plain sentence about where the mask lies, e.g. "mostly across the forehead, on the left of the photo". */
export function describeRegions(m: MaskRegions): string {
  if (m.coveragePercent < 0.2) return 'almost nothing was marked';
  const ranked = (Object.entries(m.bands) as [keyof typeof BAND_WORDS, number][]).sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  const where =
    first![1] >= 0.6
      ? `mostly in ${BAND_WORDS[first![0]]}`
      : second![1] >= 0.3
        ? `across ${BAND_WORDS[first![0]]} and ${BAND_WORDS[second![0]]}`
        : 'spread across the face';
  const side = m.sides.left >= 0.65 ? ', more on the left of the photo' : m.sides.right >= 0.65 ? ', more on the right of the photo' : '';
  const amount = m.coveragePercent < 2 ? 'a small area' : m.coveragePercent < 8 ? 'a modest area' : 'a wide area';
  return `${amount} (about ${m.coveragePercent < 10 ? m.coveragePercent.toFixed(1) : Math.round(m.coveragePercent)}% of the photo), ${where}${side}`;
}
