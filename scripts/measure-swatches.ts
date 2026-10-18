/**
 * Measure a try-on colour for each colour-shelf shade from the brand's own
 * swatch image, and record how it was measured.
 *
 *   npx tsx scripts/measure-swatches.ts           # report only
 *   npx tsx scripts/measure-swatches.ts --write   # update products-colour.json
 *
 * Brands publish swatch images, not colour values, and the makeup try-on
 * needs a hex colour. Swatches are product smears on white, so the mean
 * colour is washed out by the background. This takes the 8 % of pixels
 * furthest from white (the densest part of the smear), drops the darkest
 * tenth of those (shadows, packaging edges) and reports their median.
 * The result is an approximation and is always labelled as one. Images are
 * read into memory only; nothing is saved.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ProductSchema } from '../src/lib/catalogue/schema';

const FILE = path.join(process.cwd(), 'src/data/catalogue/products-colour.json');
const write = process.argv.includes('--write');
const today = new Date().toISOString().slice(0, 10);

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

async function measure(url: string): Promise<{ hex: string; sampled: number; total: number }> {
  const res = await fetch(url, { headers: { Accept: 'image/*' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 })
    .flatten({ background: '#ffffff' })
    .resize(320, 320, { fit: 'inside' })
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px: { r: number; g: number; b: number; d: number; l: number }[] = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    px.push({ r, g, b, d: Math.hypot(255 - r, 255 - g, 255 - b), l: 0.2126 * r + 0.7152 * g + 0.0722 * b });
  }
  const dense = px.sort((a, b) => b.d - a.d).slice(0, Math.max(50, Math.round(px.length * 0.08)));
  const trimmed = dense.sort((a, b) => a.l - b.l).slice(Math.round(dense.length * 0.1));
  return {
    hex: hex(median(trimmed.map((p) => p.r)), median(trimmed.map((p) => p.g)), median(trimmed.map((p) => p.b))),
    sampled: trimmed.length,
    total: px.length,
  };
}

async function main() {
  const products = JSON.parse(fs.readFileSync(FILE, 'utf8')) as unknown[];
  let changed = 0;
  for (const raw of products) {
    const p = ProductSchema.parse(raw);
    for (const s of p.shades) {
      if (!s.swatch) {
        console.log(`${p.id}/${s.id}: no brand swatch, not previewable`);
        continue;
      }
      try {
        const m = await measure(s.swatch.imageUrl);
        console.log(`${p.id}/${s.id}: ${m.hex} (${m.sampled} of ${m.total} pixels)`);
        const target = (raw as { shades: { id: string; render: unknown }[] }).shades.find((x) => x.id === s.id)!;
        target.render = {
          hex: m.hex,
          method: 'measured_from_brand_swatch',
          measuredOn: today,
          detail: `Median of the densest ${m.sampled} of ${m.total} pixels in the brand's swatch image (smear on white), with the darkest tenth dropped. An approximation: the brand publishes no colour value.`,
        };
        changed++;
      } catch (err) {
        console.log(`${p.id}/${s.id}: could not measure (${err instanceof Error ? err.message : String(err)})`);
      }
    }
  }
  if (write) {
    fs.writeFileSync(FILE, JSON.stringify(products, null, 2) + '\n');
    console.log(`Wrote ${changed} measured colours to ${path.relative(process.cwd(), FILE)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
