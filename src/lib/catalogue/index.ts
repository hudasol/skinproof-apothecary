import botanicalsJson from '@/data/catalogue/botanicals.json';
import studiesJson from '@/data/catalogue/studies.json';
import skincareJson from '@/data/catalogue/products-skincare.json';
import colourJson from '@/data/catalogue/products-colour.json';
import { catalogueVersion } from '../ledger/engine';
import { listContains, splitIngredients } from './ingredients';
import { CatalogueSchema, type Botanical, type Catalogue, type Product, type Study } from './schema';

/**
 * The curated catalogue, validated once at load. A record that breaks the
 * schema or a cross-reference stops the app from starting rather than being
 * shown half-checked (docs/CATALOGUE-METHOD.md).
 */

export class CatalogueError extends Error {
  constructor(readonly problems: string[]) {
    super(`Catalogue failed validation:\n- ${problems.join('\n- ')}`);
    this.name = 'CatalogueError';
  }
}

/** Cross-reference checks the schema cannot express. Returns every problem found. */
export function checkCatalogue(cat: Catalogue): string[] {
  const problems: string[] = [];
  const dup = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`Duplicate ${kind} id ${id}`);
      seen.add(id);
    }
  };
  dup('botanical', cat.botanicals.map((b) => b.id));
  dup('study', cat.studies.map((s) => s.id));
  dup('product', cat.products.map((p) => p.id));
  const botanicalIds = new Set(cat.botanicals.map((b) => b.id));

  for (const s of cat.studies) {
    if (!botanicalIds.has(s.botanicalId)) problems.push(`Study ${s.id} refers to unknown botanical ${s.botanicalId}`);
    if (s.preparation.form === 'isolated_compound' && !s.preparation.compound) problems.push(`Study ${s.id} is an isolated compound with no compound named`);
  }
  for (const p of cat.products) {
    dup(`shade in ${p.id}`, p.shades.map((s) => s.id));
    const hasList = !!p.ingredientsVerbatim || (p.shades.length > 0 && p.shades.every((s) => !!s.ingredientsVerbatim));
    if (p.verification !== 'unverified' && !hasList) problems.push(`Product ${p.id} is ${p.verification} but has no ingredient list`);
    if (p.verification === 'unverified' && p.ingredientsVerbatim) problems.push(`Product ${p.id} is unverified but carries an ingredient list`);
    if (p.verification !== 'verified' && !p.verificationNote) problems.push(`Product ${p.id} is ${p.verification} without a note saying why`);
    if (p.shelf === 'skincare' && p.shades.length) problems.push(`Skincare product ${p.id} has shades`);
    if (p.shelf === 'colour' && p.botanicals.length) problems.push(`Colour product ${p.id} makes botanical links; colour products make no efficacy claims`);
    const list = p.ingredientsVerbatim ? [...p.actives.map((a) => a.name), ...splitIngredients(p.ingredientsVerbatim)] : [];
    for (const b of p.botanicals) {
      if (!botanicalIds.has(b.botanicalId)) problems.push(`Product ${p.id} refers to unknown botanical ${b.botanicalId}`);
      if (p.ingredientsVerbatim && !listContains(list, b.inci)) problems.push(`Product ${p.id}: “${b.inci}” is not on its ingredient list`);
      if (b.preparation.form === 'isolated_compound' && !b.preparation.compound) problems.push(`Product ${p.id}: ${b.inci} is an isolated compound with no compound named`);
    }
    if (p.actives.length && p.ingredientsVerbatim === null) problems.push(`Product ${p.id} lists actives without an ingredient list`);
    for (const s of p.shades) {
      if (s.render && !s.swatch) problems.push(`Shade ${p.id}/${s.id} has a render colour but no swatch it was measured from`);
    }
  }
  return problems;
}

function load(): Catalogue {
  const parsed = CatalogueSchema.safeParse({
    botanicals: botanicalsJson,
    studies: studiesJson,
    products: [...(skincareJson as unknown[]), ...(colourJson as unknown[])],
  });
  if (!parsed.success) {
    throw new CatalogueError(parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  const problems = checkCatalogue(parsed.data);
  if (problems.length) throw new CatalogueError(problems);
  return parsed.data;
}

let cached: { catalogue: Catalogue; version: string } | null = null;

export function getCatalogue(): Catalogue {
  if (!cached) {
    const catalogue = load();
    cached = { catalogue, version: catalogueVersion(catalogue) };
  }
  return cached.catalogue;
}

export function getCatalogueVersion(): string {
  getCatalogue();
  return cached!.version;
}

export function getBotanical(id: string): Botanical | undefined {
  return getCatalogue().botanicals.find((b) => b.id === id);
}

export function getProduct(id: string): Product | undefined {
  return getCatalogue().products.find((p) => p.id === id);
}

export function studiesFor(botanicalId: string): Study[] {
  return getCatalogue()
    .studies.filter((s) => s.botanicalId === botanicalId)
    .sort((a, b) => b.citation.year - a.citation.year || a.id.localeCompare(b.id));
}

export function getStudy(id: string): Study | undefined {
  return getCatalogue().studies.find((s) => s.id === id);
}

export function productsContaining(botanicalId: string): Product[] {
  return getCatalogue().products.filter((p) => p.botanicals.some((b) => b.botanicalId === botanicalId));
}
