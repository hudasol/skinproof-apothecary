import sharp from 'sharp';

/**
 * Synthetic, non-photographic test images. The repository ships no photos of
 * people; these shapes only exercise decoding, sizing and pixel maths.
 */
export function syntheticRgb(width: number, height: number, seed = 1): Uint8Array {
  const out = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const dx = (x - width / 2) / (width * 0.32);
      const dy = (y - height * 0.48) / (height * 0.4);
      const inOval = dx * dx + dy * dy < 1;
      // Smooth gradients, like a studio backdrop; the seed shifts the tones.
      out[i] = inOval ? 214 : Math.round(60 + (40 * x) / width + seed * 3);
      out[i + 1] = inOval ? 170 : Math.round(70 + (40 * y) / height + seed);
      out[i + 2] = inOval ? 150 : 90 + seed;
    }
  }
  return out;
}

export async function syntheticJpeg(width: number, height: number, opts: { quality?: number; seed?: number } = {}): Promise<Buffer> {
  return sharp(Buffer.from(syntheticRgb(width, height, opts.seed)), { raw: { width, height, channels: 3 } })
    .jpeg({ quality: opts.quality ?? 95 })
    .toBuffer();
}

export async function syntheticPng(width: number, height: number): Promise<Buffer> {
  return sharp(Buffer.from(syntheticRgb(width, height)), { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/** Paint a filled rectangle into a packed RGB buffer (returns a copy). */
export function paintRect(
  rgb: Uint8Array,
  width: number,
  rect: { x: number; y: number; w: number; h: number },
  color: [number, number, number],
): Uint8Array {
  const out = new Uint8Array(rgb);
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = (y * width + x) * 3;
      out[i] = color[0];
      out[i + 1] = color[1];
      out[i + 2] = color[2];
    }
  }
  return out;
}
