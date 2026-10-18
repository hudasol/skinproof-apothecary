import type { Botanical, Catalogue, Product, Study } from '@/lib/catalogue/schema';
import { EMPTY_CONSTRAINTS } from '@/lib/domain/profile';
import type { LedgerInput } from '@/lib/ledger/types';

/**
 * Synthetic catalogue records for rule tests. Names are invented ("Testplant")
 * so they can never be mistaken for real products or real studies.
 */

export function botanical(id: string, over: Partial<Botanical> = {}): Botanical {
  return {
    id,
    commonName: `Testplant ${id}`,
    scientificName: `Testus ${id}`,
    family: 'Testaceae',
    inciNames: [`Testus ${id} Leaf Extract`],
    summary: 'Synthetic test record.',
    safetyNotes: [],
    reviewedOn: '2026-10-18',
    ...over,
  };
}

let studyCounter = 0;
export function study(botanicalId: string, over: Partial<Study> = {}): Study {
  studyCounter++;
  return {
    id: `study-${botanicalId}-${studyCounter}`,
    botanicalId,
    citation: { authors: 'Test A', title: 'Synthetic', journal: 'Test J', year: 2020, pmid: null, doi: null, url: 'https://example.org/s' },
    design: 'rct',
    setting: 'cosmetic',
    isolatesBotanical: true,
    randomised: true,
    blinded: 'double',
    control: 'vehicle',
    population: 'adults',
    n: 40,
    durationWeeks: 8,
    preparation: { part: 'leaf', form: 'extract', compound: null },
    preparationText: 'leaf extract cream',
    concentration: null,
    use: 'leave_on',
    outcomes: [{ goal: 'calm_visible_redness', measure: 'erythema', finding: 'supports', summary: 'Less redness.' }],
    limitations: 'Synthetic.',
    funding: null,
    reviewedOn: '2026-10-18',
    ...over,
  };
}

export function product(id: string, over: Partial<Product> = {}): Product {
  return {
    id,
    brand: 'Testbrand',
    name: `Product ${id}`,
    shelf: 'skincare',
    category: 'moisturiser',
    use: 'leave_on',
    source: { url: `https://example.org/${id}`, type: 'brand', checkedOn: '2026-10-18', secondaryUrl: null },
    verification: 'verified',
    verificationNote: null,
    ingredientsVerbatim: 'Aqua, Glycerin, Testus a Leaf Extract, Phenoxyethanol',
    actives: [],
    sourceConflicts: null,
    botanicals: [{ inci: 'Testus a Leaf Extract', botanicalId: 'a', preparation: { part: 'leaf', form: 'extract', compound: null }, concentration: null }],
    retailers: [],
    shades: [],
    description: 'Synthetic test record.',
    ...over,
  };
}

export function catalogue(over: Partial<Catalogue> = {}): Catalogue {
  return { botanicals: [botanical('a'), botanical('b')], studies: [study('a')], products: [product('p1')], ...over };
}

export function input(over: Partial<LedgerInput> = {}): LedgerInput {
  return {
    goals: ['calm_visible_redness'],
    constraints: { ...EMPTY_CONSTRAINTS },
    reactiveSkin: false,
    preferredCategories: [],
    ...over,
  };
}
