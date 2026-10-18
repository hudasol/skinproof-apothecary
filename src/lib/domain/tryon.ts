/**
 * Makeup try-on payloads for colour-shelf shades, limited to the documented
 * `lip_color` contract (docs/API-VERIFICATION.md).
 *
 * Rendering settings are SkinProof's own, not brand data: tinted balms are
 * sheer and dewy, so they are rendered with the `gloss` texture (live-verified
 * by TryOn on the same account) at moderate intensity and transparency. The
 * `sheer` texture is documented but has not been verified live.
 */

export const LIP_RENDER = {
  shape: 'original',
  texture: 'gloss',
  colorIntensity: 55,
  gloss: 55,
  transparencyIntensity: 40,
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
