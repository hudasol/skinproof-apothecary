import sharp from 'sharp';

/**
 * Photo handling. One upload is normalised once, then fitted separately to
 * each API's documented limits (docs/API-VERIFICATION.md):
 *
 * - Skin Analysis (SD): jpg/png under 10 MB, short side ≥ 480 px, long side
 *   resized by the service above 2560 px. The face should fill > 60 % of the
 *   width, so the person can crop before upload.
 * - Makeup VTO: within 1919 × 1079 (both readings of the documented limit),
 *   with even sides so the output aligns with the input (verified by TryOn).
 *
 * Every derived image is re-encoded from decoded pixels: EXIF orientation is
 * applied and all metadata (GPS, device, timestamps) is dropped.
 */

export const PHOTO_LIMITS = {
  maxUploadBytes: 10 * 1024 * 1024 - 1,
  minShortSide: 480,
  maxLongSide: 2560,
  maxInputPixels: 40_000_000,
  acceptedFormats: ['jpeg', 'png', 'webp'] as const,
  acceptedMime: ['image/jpeg', 'image/png', 'image/webp'] as const,
};

export const PREVIEW_LIMITS = { maxWidth: 1919, maxHeight: 1079 };

export class ImageRejectedError extends Error {
  constructor(message: string, readonly code: 'too_large' | 'empty' | 'not_an_image' | 'unsupported_format' | 'too_small' | 'too_many_pixels' | 'bad_crop') {
    super(message);
    this.name = 'ImageRejectedError';
  }
}

/** Crop as fractions of the (orientation-corrected) image, from the browser's crop tool. */
export type Crop = { x: number; y: number; width: number; height: number };

export type NormalisedPhoto = { data: Buffer; width: number; height: number; mimeType: 'image/jpeg' };

async function inspect(input: Uint8Array) {
  if (input.byteLength === 0) throw new ImageRejectedError('The file is empty.', 'empty');
  if (input.byteLength > PHOTO_LIMITS.maxUploadBytes) throw new ImageRejectedError('Photos must be under 10 MB.', 'too_large');
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: PHOTO_LIMITS.maxInputPixels }).metadata();
  } catch {
    throw new ImageRejectedError('This file could not be read as an image.', 'not_an_image');
  }
  if (!(PHOTO_LIMITS.acceptedFormats as readonly string[]).includes(meta.format ?? '')) {
    throw new ImageRejectedError('Use a JPEG, PNG or WebP photo.', 'unsupported_format');
  }
  if (!meta.width || !meta.height) throw new ImageRejectedError('This file could not be read as an image.', 'not_an_image');
  if (meta.width * meta.height > PHOTO_LIMITS.maxInputPixels) throw new ImageRejectedError('The photo has too many pixels to process safely.', 'too_many_pixels');
  const swap = (meta.orientation ?? 1) >= 5 && (meta.orientation ?? 1) <= 8;
  return { width: swap ? meta.height : meta.width, height: swap ? meta.width : meta.height };
}

export function validCrop(c: Crop | null | undefined): c is Crop {
  if (!c) return false;
  const ok = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
  return ok(c.x) && ok(c.y) && ok(c.width) && ok(c.height) && c.width > 0.05 && c.height > 0.05 && c.x + c.width <= 1.0001 && c.y + c.height <= 1.0001;
}

/** Decode, orient, crop, strip metadata and fit within the analysis limits. */
export async function normalisePhoto(input: Uint8Array, crop?: Crop | null): Promise<NormalisedPhoto> {
  const size = await inspect(input);
  if (crop && !validCrop(crop)) throw new ImageRejectedError('The crop area was not valid. Try selecting it again.', 'bad_crop');
  let pipeline = sharp(input, { limitInputPixels: PHOTO_LIMITS.maxInputPixels }).rotate();
  let w = size.width;
  let h = size.height;
  if (crop) {
    const left = Math.max(0, Math.min(w - 1, Math.round(crop.x * w)));
    const top = Math.max(0, Math.min(h - 1, Math.round(crop.y * h)));
    const cw = Math.max(1, Math.min(w - left, Math.round(crop.width * w)));
    const ch = Math.max(1, Math.min(h - top, Math.round(crop.height * h)));
    // rotate() must run before extract(), so materialise the rotation first.
    const rotated = await pipeline.toBuffer();
    pipeline = sharp(rotated).extract({ left, top, width: cw, height: ch });
    w = cw;
    h = ch;
  }
  if (Math.min(w, h) < PHOTO_LIMITS.minShortSide) {
    throw new ImageRejectedError(
      crop
        ? `The cropped area is ${w} × ${h} pixels; skin analysis needs at least ${PHOTO_LIMITS.minShortSide} on the shorter side. Select a larger area or use a sharper photo.`
        : `This photo is ${w} × ${h} pixels; skin analysis needs at least ${PHOTO_LIMITS.minShortSide} on the shorter side.`,
      'too_small',
    );
  }
  const { data, info } = await pipeline
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .resize(PHOTO_LIMITS.maxLongSide, PHOTO_LIMITS.maxLongSide, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, mimeType: 'image/jpeg' };
}

/** Fit a normalised photo to the makeup try-on limits, with even sides. */
export async function fitForPreview(photo: Uint8Array): Promise<NormalisedPhoto> {
  const meta = await sharp(photo).metadata();
  const scale = Math.min(1, PREVIEW_LIMITS.maxWidth / meta.width!, PREVIEW_LIMITS.maxHeight / meta.height!);
  const fw = Math.floor(meta.width! * scale);
  const fh = Math.floor(meta.height! * scale);
  const width = fw - (fw % 2);
  const height = fh - (fh % 2);
  const data = await sharp(photo).resize(width, height, { fit: 'cover', position: 'centre' }).jpeg({ quality: 93, chromaSubsampling: '4:4:4' }).toBuffer();
  return { data, width, height, mimeType: 'image/jpeg' };
}

/** Is this a decodable JPEG or PNG? Used on every provider output before it is stored. */
export async function inspectOutput(data: Uint8Array): Promise<{ width: number; height: number; mimeType: 'image/jpeg' | 'image/png' } | null> {
  try {
    const meta = await sharp(data, { limitInputPixels: PHOTO_LIMITS.maxInputPixels }).metadata();
    if (!meta.width || !meta.height || (meta.format !== 'jpeg' && meta.format !== 'png')) return null;
    await sharp(data).raw().toBuffer();
    return { width: meta.width, height: meta.height, mimeType: meta.format === 'png' ? 'image/png' : 'image/jpeg' };
  } catch {
    return null;
  }
}
