/**
 * Reading an ingredient label. Everything here works on the verbatim list as
 * published; it never infers concentration from position, and a match always
 * names the ingredient that caused it so the person can check it themselves.
 */

/** Split an INCI list on top-level commas, keeping parenthesised names intact. */
export function splitIngredients(verbatim: string): string[] {
  // "May contain" / "+/-" colourant sections are still ingredients of some shades.
  const text = verbatim
    .replace(/\r?\n/g, ' ')
    // A trailing footnote such as "*certified organic ingredient…" or "Contains Hazelnut Oil." is not an ingredient.
    .replace(/\s\*[A-Za-z][^,]*$/, '')
    .replace(/\[\s*\+\/-\s*/gi, ', ')
    .replace(/\]/g, '');
  const out: string[] = [];
  let depth = 0;
  let current = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    // A comma between digits belongs to a chemical name, as in 1,2-Hexanediol.
    const inNumber = ch === ',' && /[0-9]/.test(chars[i - 1] ?? '') && /[0-9]/.test(chars[i + 1] ?? '');
    if ((ch === ',' || ch === '•' || ch === '·') && depth === 0 && !inNumber) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  const cleaned = out
    .map((s) =>
      s
        .replace(/^\s*(ingredients|inactive ingredients|may contain|\+\/-)\s*:?\s*/i, '')
        .replace(/[*†‡]+/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s;:]+|[\s;:]+$/g, '')
        .trim(),
    )
    .filter((s) => s.length > 0);
  // A full stop that ends the whole list is punctuation; "Alcohol Denat." keeps its abbreviation dot.
  const last = cleaned.length - 1;
  if (last >= 0 && /\.$/.test(cleaned[last]!) && !/\b(denat|ext)\.$/i.test(cleaned[last]!)) {
    cleaned[last] = cleaned[last]!.replace(/\.+$/, '');
  }
  return cleaned;
}

export type IngredientMatch = { ingredient: string; note?: string };

const FRAGRANCE_WORDS = /\b(parfum|fragrance|aroma|flavou?r)\b/i;
/** Named scent materials that are not on the EU allergen list but are added for scent or flavour. */
const SCENT_MATERIALS: Record<string, string> = {
  vanillin: 'Vanillin is a scent and flavour material.',
  'ethyl vanillin': 'Ethyl vanillin is a scent and flavour material.',
};

export function findFragrance(ingredients: string[]): IngredientMatch[] {
  const out: IngredientMatch[] = [];
  for (const ing of ingredients) {
    const lower = ing.toLowerCase();
    if (FRAGRANCE_WORDS.test(ing)) out.push({ ingredient: ing });
    else if (SCENT_MATERIALS[lower]) out.push({ ingredient: ing, note: SCENT_MATERIALS[lower] });
  }
  return out;
}

/**
 * The 26 fragrance allergens that must be named on EU cosmetic labels
 * (Regulation (EC) No 1223/2009, Annex III). Regulation (EU) 2023/1545 adds
 * more names with a transition period; this list is the original 26.
 */
export const EU_FRAGRANCE_ALLERGENS = [
  'amyl cinnamal',
  'amylcinnamyl alcohol',
  'anise alcohol',
  'benzyl alcohol',
  'benzyl benzoate',
  'benzyl cinnamate',
  'benzyl salicylate',
  'butylphenyl methylpropional',
  'cinnamal',
  'cinnamyl alcohol',
  'citral',
  'citronellol',
  'coumarin',
  'eugenol',
  'evernia furfuracea extract',
  'evernia prunastri extract',
  'farnesol',
  'geraniol',
  'hexyl cinnamal',
  'hydroxycitronellal',
  'hydroxyisohexyl 3-cyclohexene carboxaldehyde',
  'isoeugenol',
  'limonene',
  'linalool',
  'methyl 2-octynoate',
  'alpha-isomethyl ionone',
] as const;

export const ALLERGEN_SOURCE = {
  title: 'Regulation (EC) No 1223/2009 on cosmetic products, Annex III',
  url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02009R1223-20240424',
};

const DUAL_USE: Record<string, string> = {
  'benzyl alcohol': 'Benzyl Alcohol is also used as a preservative; the label does not say which role it plays here.',
};

export function findFragranceAllergens(ingredients: string[]): IngredientMatch[] {
  const out: IngredientMatch[] = [];
  for (const ing of ingredients) {
    const base = ing.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const hit = EU_FRAGRANCE_ALLERGENS.find((a) => base === a || base.startsWith(`${a} `) || base.startsWith(`${a}*`));
    if (hit) out.push({ ingredient: ing, note: DUAL_USE[hit] });
  }
  return out;
}

/**
 * Genera whose leaf, flower, peel, herb, wood, resin or root oils are
 * essential oils. Seed, kernel and nut oils of these plants are fixed
 * (pressed) oils and are not counted, except where noted.
 */
const ESSENTIAL_OIL_GENERA = [
  'abies', 'anthemis', 'boswellia', 'cananga', 'cedrus', 'chamaemelum', 'chamomilla', 'cinnamomum', 'citrus',
  'commiphora', 'coriandrum', 'cupressus', 'cymbopogon', 'eucalyptus', 'eugenia', 'foeniculum', 'illicium',
  'jasminum', 'juniperus', 'lavandula', 'litsea', 'matricaria', 'melaleuca', 'mentha', 'ocimum', 'origanum',
  'pelargonium', 'pinus', 'pogostemon', 'rosmarinus', 'salvia', 'santalum', 'syzygium', 'thymus', 'vetiveria',
  'zingiber', 'rosa', 'michelia', 'aniba', 'leptospermum', 'elettaria',
];
const FIXED_OIL_PARTS = /\b(seed|kernel|nut)\s+oil\b/i;
/** Citrus fruit oils are pressed from the peel and are essential oils; other fruit oils (olive, avocado) are not. */
const NON_CITRUS_FRUIT_OIL = /\bfruit\s+oil\b/i;

export function findEssentialOils(ingredients: string[]): IngredientMatch[] {
  const out: IngredientMatch[] = [];
  for (const ing of ingredients) {
    const lower = ing.toLowerCase();
    if (!/\boil\b/.test(lower)) continue;
    if (/\b(hydrogenated|unsaponifiables|ester|ethyl ester|glycerides?)\b/.test(lower)) continue;
    const genus = lower.split(/[\s(]/)[0] ?? '';
    if (!ESSENTIAL_OIL_GENERA.includes(genus)) continue;
    // Rosa canina / rubiginosa *seed* oil (rosehip) is pressed, not distilled.
    if (FIXED_OIL_PARTS.test(lower)) continue;
    if (genus !== 'citrus' && NON_CITRUS_FRUIT_OIL.test(lower)) continue;
    out.push({ ingredient: ing });
  }
  return out;
}

/**
 * Genera of the daisy family (Asteraceae, also called Compositae), as named
 * on cosmetic labels. Includes sunflower and safflower: their refined seed
 * oils carry little of the sesquiterpene lactones behind most Compositae
 * allergy, but the person asked to avoid the family, so they are excluded
 * and the dossier says so.
 */
export const ASTERACEAE_GENERA = [
  'achillea', 'acmella', 'ageratum', 'anthemis', 'arctium', 'arnica', 'artemisia', 'bellis', 'bidens', 'calendula',
  'carthamus', 'centaurea', 'chamaemelum', 'chamomilla', 'chrysanthemum', 'cichorium', 'cosmos', 'cynara', 'dahlia',
  'echinacea', 'eclipta', 'gnaphalium', 'helianthus', 'helichrysum', 'inula', 'lactuca', 'leontopodium', 'matricaria',
  'santolina', 'senecio', 'silybum', 'solidago', 'spilanthes', 'stevia', 'tagetes', 'tanacetum', 'taraxacum', 'tussilago',
];

export const ASTERACEAE_SOURCE = {
  title: 'DermNet: Compositae allergy',
  url: 'https://dermnetnz.org/topics/compositae-allergy',
};

const REFINED_SEED_OIL = /\b(helianthus|carthamus)\b.*\bseed oil\b/i;

export function findAsteraceae(ingredients: string[]): IngredientMatch[] {
  const out: IngredientMatch[] = [];
  for (const ing of ingredients) {
    const genus = ing.toLowerCase().split(/[\s(]/)[0] ?? '';
    if (!ASTERACEAE_GENERA.includes(genus)) continue;
    out.push({
      ingredient: ing,
      note: REFINED_SEED_OIL.test(ing)
        ? 'A seed oil from the daisy family. Refined seed oils usually carry little of the compounds behind Compositae allergy; it is excluded because you chose to avoid the family.'
        : undefined,
    });
  }
  return out;
}

/** Match a person's free-text ingredient against label ingredients, as a case-insensitive whole-word phrase. */
export function findNamedIngredient(ingredients: string[], term: string): IngredientMatch[] {
  const needle = term.toLowerCase().replace(/[.]+$/, '').trim();
  if (needle.length < 3) return [];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, 'iu');
  return ingredients.filter((i) => re.test(i)).map((ingredient) => ({ ingredient }));
}

/** Does the verbatim list contain this exact INCI entry? Used by the catalogue check. */
export function listContains(ingredients: string[], inci: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return ingredients.some((i) => n(i) === n(inci));
}
