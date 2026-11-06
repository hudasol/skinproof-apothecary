/**
 * Makeup try-on payloads for colour-shelf shades, limited to the documented
 * `lip_color` contract (docs/API-VERIFICATION.md).
 *
 * Rendering settings are SkinProof's own, not brand data. The first values
 * (intensity 55, transparency 40) came out too sheer to judge a shade, so the
 * colour is now strong (intensity 90, transparency 10) with a light gloss, so
 * the person can see the shade itself. Lip placement is done by YouCam's own
 * lip detection, not by SkinProof.
 */

export const LIP_RENDER = {
  shape: 'original',
  texture: 'gloss',
  colorIntensity: 90,
  gloss: 40,
  transparencyIntensity: 10,
} as const;

export type MakeupEffect =
  | { category: 'skin_smooth'; skinSmoothStrength: 0; skinSmoothColorIntensity: 0 }
  | {
      category: 'lip_color';
      shape: { name: string };
      morphology: { fullness: number; wrinkless: number };
      style: { type: 'full' };
      palettes: [{ color: string; texture: 'gloss'; colorIntensity: number; gloss: number; transparencyIntensity: number }];
    };

export type MakeupTaskEffects = { version: '1.0'; effects: MakeupEffect[] };

/**
 * Build the effects payload for one shade. Skin smoothing is always sent at
 * 0: the engine otherwise smooths the whole face by default, and a skincare
 * shop must never show retouched skin next to its products.
 */
export function buildLipEffects(hex: string): MakeupTaskEffects {
  if (!/^#[0-9A-F]{6}$/i.test(hex)) throw new Error('Shade colour must be #RRGGBB');
  return {
    version: '1.0',
    effects: [
      { category: 'skin_smooth', skinSmoothStrength: 0, skinSmoothColorIntensity: 0 },
      {
        category: 'lip_color',
        shape: { name: LIP_RENDER.shape },
        morphology: { fullness: 0, wrinkless: 0 },
        style: { type: 'full' },
        palettes: [
          {
            color: hex.toUpperCase(),
            texture: LIP_RENDER.texture,
            colorIntensity: LIP_RENDER.colorIntensity,
            gloss: LIP_RENDER.gloss,
            transparencyIntensity: LIP_RENDER.transparencyIntensity,
          },
        ],
      },
    ],
  };
}
