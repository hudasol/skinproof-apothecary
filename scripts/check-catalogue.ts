/**
 * Validate the curated catalogue and print what the label reader finds in
 * each product, so a curator can review every automatic match.
 *
 *   npm run catalogue:check
 */
import { getCatalogue, getCatalogueVersion } from '../src/lib/catalogue';
import { readLabel } from '../src/lib/ledger/engine';

const cat = getCatalogue();
console.log(`Catalogue ${getCatalogueVersion()}: ${cat.botanicals.length} botanicals, ${cat.studies.length} studies, ${cat.products.length} products\n`);

const byStatus = { verified: 0, partial: 0, unverified: 0 };
for (const p of cat.products) {
  byStatus[p.verification]++;
  const lists = p.ingredientsVerbatim ? [{ label: 'label', text: p.ingredientsVerbatim }] : p.shades.filter((s) => s.ingredientsVerbatim).map((s) => ({ label: s.id, text: s.ingredientsVerbatim! }));
  console.log(`${p.id} [${p.verification}] ${p.shelf}/${p.category}, ${p.botanicals.length} botanical links`);
  for (const l of lists) {
    const r = readLabel(l.text, l.label === 'label' ? p.actives.map((a) => a.name) : []);
    const show = (name: string, m: { ingredient: string }[]) => m.length && console.log(`    ${l.label} ${name}: ${m.map((x) => x.ingredient).join('; ')}`);
    console.log(`    ${l.label}: ${r.ingredients.length} ingredients`);
    show('fragrance', r.fragrance);
    show('essential oils', r.essentialOils);
    show('allergens', r.allergens);
    show('daisy family', r.asteraceae);
  }
}
console.log(`\nVerification: ${byStatus.verified} verified, ${byStatus.partial} partial, ${byStatus.unverified} unverified`);
console.log('All schema and cross-reference checks passed.');
