import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { artifacts } from '@/lib/db/schema';
import { isValidId } from '@/lib/domain/ids';
import { ArtifactIntegrityError, readArtifact } from '@/lib/storage/artifacts';
import { currentConsultationId } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Serve one of the visitor's own images. Every image belongs to a
 * consultation and is served only to the browser holding that consultation's
 * cookie; it is never cached by shared caches.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const owner = await currentConsultationId();
  if (!owner || !isValidId(id, 'artifact')) return new Response('Not found', { status: 404 });
  const row = getDb().select().from(artifacts).where(and(eq(artifacts.id, id), eq(artifacts.consultationId, owner))).get();
  if (!row) return new Response('This image has been deleted or does not exist.', { status: 404 });
  try {
    const data = await readArtifact(row);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': row.mimeType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Provenance': row.provenance,
      },
    });
  } catch (err) {
    if (err instanceof ArtifactIntegrityError) return new Response('This image is missing or failed its integrity check.', { status: 410 });
    throw err;
  }
}
