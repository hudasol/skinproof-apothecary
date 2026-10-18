import { getDb } from '@/lib/db/client';
import { isValidId } from '@/lib/domain/ids';
import { getPreview } from '@/lib/services/previews';
import { currentConsultationId } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const owner = await currentConsultationId();
  const row = owner && isValidId(id, 'preview') ? getPreview(getDb(), id, owner) : undefined;
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(
    {
      id: row.id,
      status: row.status,
      failure: row.failure,
      providerMode: row.providerMode,
      inputArtifactId: row.inputArtifactId,
      outputArtifactId: row.outputArtifactId,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
