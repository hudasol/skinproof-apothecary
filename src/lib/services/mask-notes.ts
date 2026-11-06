import 'server-only';
import sharp from 'sharp';
import type { Db } from '../db/client';
import { artifacts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { describeRegions, measureMask } from '../domain/mask-regions';
import { readArtifact } from '../storage/artifacts';
import type { ScoredConcern } from '../domain/skin';

const GRID = 60;

/**
 * Where each detection mask lies, in words. Only masks the provider really
 * returned are described; a fixture analysis has none, so this is empty.
 */
export async function maskNotes(db: Db, items: { concern: ScoredConcern; maskArtifactId: string | null }[]): Promise<Partial<Record<ScoredConcern, string>>> {
  const out: Partial<Record<ScoredConcern, string>> = {};
  for (const item of items) {
    if (!item.maskArtifactId) continue;
    try {
      const art = db.select().from(artifacts).where(eq(artifacts.id, item.maskArtifactId)).get();
      if (!art) continue;
      const { data, info } = await sharp(await readArtifact(art))
        .ensureAlpha()
        .resize(GRID, GRID, { fit: 'fill', kernel: 'nearest' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const regions = measureMask(data, info.width, info.height);
      if (regions) out[item.concern] = describeRegions(regions);
    } catch {
      // A mask that cannot be read simply gets no note.
    }
  }
  return out;
}
