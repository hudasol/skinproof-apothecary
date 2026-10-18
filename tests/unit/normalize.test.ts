import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { fitForPreview, ImageRejectedError, inspectOutput, normalisePhoto, validCrop } from '@/lib/images/normalize';
import { syntheticJpeg, syntheticPng } from '../helpers/images';

describe('normalisePhoto', () => {
  it('re-encodes to JPEG, drops metadata and keeps the size within limits', async () => {
    const input = await sharp(await syntheticJpeg(800, 1000)).withMetadata({ exif: { IFD0: { Copyright: 'secret-device' } } }).jpeg().toBuffer();
    const out = await normalisePhoto(input);
    expect(out).toMatchObject({ width: 800, height: 1000, mimeType: 'image/jpeg' });
    const meta = await sharp(out.data).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it('shrinks very large photos to a 2560 px long side', async () => {
    const out = await normalisePhoto(await syntheticJpeg(1200, 3000));
    expect(Math.max(out.width, out.height)).toBe(2560);
  });

  it('applies a crop and refuses a crop smaller than the analysis minimum', async () => {
    const big = await syntheticPng(1000, 1200);
    const out = await normalisePhoto(big, { x: 0.1, y: 0.1, width: 0.6, height: 0.6 });
    expect([out.width, out.height]).toEqual([600, 720]);
    await expect(normalisePhoto(big, { x: 0, y: 0, width: 0.3, height: 0.3 })).rejects.toMatchObject({ code: 'too_small' });
  });

  it('rejects invalid crops, non-images, empty files and small photos with plain messages', async () => {
    await expect(normalisePhoto(await syntheticJpeg(800, 800), { x: 0.9, y: 0, width: 0.5, height: 0.5 })).rejects.toMatchObject({ code: 'bad_crop' });
    await expect(normalisePhoto(Buffer.from('not an image'))).rejects.toMatchObject({ code: 'not_an_image' });
    await expect(normalisePhoto(new Uint8Array())).rejects.toBeInstanceOf(ImageRejectedError);
    await expect(normalisePhoto(await syntheticJpeg(400, 600))).rejects.toThrow(/at least 480/);
  });

  it('accepts only sane crop fractions', () => {
    expect(validCrop({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    expect(validCrop({ x: -0.1, y: 0, width: 0.5, height: 0.5 })).toBe(false);
    expect(validCrop({ x: 0, y: 0, width: Number.NaN, height: 0.5 })).toBe(false);
  });
});

describe('fitForPreview', () => {
  it('fits within 1919 × 1079 with even sides', async () => {
    const out = await fitForPreview(await syntheticJpeg(1201, 1601));
    expect(out.width % 2).toBe(0);
    expect(out.height % 2).toBe(0);
    expect(out.height).toBeLessThanOrEqual(1079);
  });
});

describe('inspectOutput', () => {
  it('accepts decodable JPEG and PNG and refuses anything else', async () => {
    expect(await inspectOutput(await syntheticPng(10, 10))).toMatchObject({ mimeType: 'image/png' });
    expect(await inspectOutput(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});
