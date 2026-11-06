import teasJson from '@/data/catalogue/teas.json';
import { TeaCatalogueSchema, type Tea } from './tea-schema';

let cached: Tea[] | null = null;

/** The herbal tea records, validated once at load. A bad record stops the app rather than being shown half checked. */
export function getTeas(): Tea[] {
  if (!cached) {
    const parsed = TeaCatalogueSchema.safeParse(teasJson);
    if (!parsed.success) {
      throw new Error(`Tea catalogue failed validation:\n- ${parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n- ')}`);
    }
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const t of parsed.data) {
      if (seen.has(t.id)) problems.push(`Duplicate tea id ${t.id}`);
      seen.add(t.id);
      const ids = new Set(t.evidence.map((e) => e.id));
      for (const g of t.goals) {
        for (const id of g.evidenceIds) if (!ids.has(id)) problems.push(`Tea ${t.id}: goal ${g.goal} cites unknown evidence ${id}`);
        if (g.tier === 'traditional' && g.sources.length === 0) problems.push(`Tea ${t.id}: traditional claim for ${g.goal} has no source`);
        if (g.tier === 'human_trial' && g.evidenceIds.length === 0) problems.push(`Tea ${t.id}: human trial claim for ${g.goal} cites no trial`);
      }
    }
    if (problems.length) throw new Error(`Tea catalogue failed validation:\n- ${problems.join('\n- ')}`);
    cached = parsed.data;
  }
  return cached;
}
