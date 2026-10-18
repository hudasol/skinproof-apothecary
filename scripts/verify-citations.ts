/**
 * Check every study's PubMed id against NCBI: the title and year recorded in
 * the catalogue must match what PubMed says. Free; needs network access.
 *
 *   npx tsx scripts/verify-citations.ts
 */
import { getCatalogue } from '../src/lib/catalogue';

type Summary = { title: string; pubdate: string; source: string };

const norm = (s: string) => s.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function main() {
  const studies = getCatalogue().studies.filter((s) => s.citation.pmid);
  const ids = studies.map((s) => s.citation.pmid!).join(',');
  const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`NCBI returned HTTP ${res.status}`);
  const body = (await res.json()) as { result: Record<string, Summary> };
  let failures = 0;
  for (const s of studies) {
    const r = body.result[s.citation.pmid!];
    const titleOk = !!r && norm(r.title).startsWith(norm(s.citation.title).slice(0, 40));
    const yearOk = !!r && r.pubdate.slice(0, 4) === String(s.citation.year);
    if (!titleOk || !yearOk) {
      failures++;
      console.log(`MISMATCH ${s.id} PMID ${s.citation.pmid}: catalogue "${s.citation.title}" (${s.citation.year}); PubMed "${r?.title ?? 'not found'}" (${r?.pubdate ?? '-'})`);
    }
  }
  console.log(`${studies.length - failures} of ${studies.length} citations match PubMed.`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
