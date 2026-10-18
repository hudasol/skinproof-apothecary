import { getDb } from '@/lib/db/client';
import { isValidId } from '@/lib/domain/ids';
import { getAnalysis } from '@/lib/services/analyses';
import { currentConsultationId } from '@/lib/session';

export const runtime = 'nodejs';

/** Job status for the progress view. Only the consultation that owns the job can read it. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const owner = await currentConsultationId();
  const row = owner && isValidId(id, 'analysis') ? getAnalysis(getDb(), id, owner) : undefined;
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(
    { id: row.id, status: row.status, failure: row.failure, providerMode: row.providerMode },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
