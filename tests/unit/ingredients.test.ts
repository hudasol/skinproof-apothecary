import { describe, expect, it } from 'vitest';
import {
  findAsteraceae,
  findEssentialOils,
  findFragrance,
  findFragranceAllergens,
  findNamedIngredient,
  listContains,
  splitIngredients,
} from '@/lib/catalogue/ingredients';

describe('splitIngredients', () => {
  it('splits on top-level commas only and trims label noise', () => {
    expect(splitIngredients('Ingredients: Aqua/Water/Eau, Butyrospermum Parkii (Shea, Karite) Butter*, Tocopherol.')).toEqual([
      'Aqua/Water/Eau',
      'Butyrospermum Parkii (Shea, Karite) Butter',
      'Tocopherol',
    ]);
  });
  it('keeps "may contain" colourants as ingredients', () => {
    expect(splitIngredients('Ricinus Communis Seed Oil, Cera Alba [+/- CI 77491 (Iron Oxides), CI 15850]')).toEqual([
      'Ricinus Communis Seed Oil',
      'Cera Alba',
      'CI 77491 (Iron Oxides)',
      'CI 15850',
    ]);
  });
});

describe('fragrance', () => {
  it('finds parfum, aroma and flavour wording and named scent materials', () => {
    const list = ['Aqua', 'Parfum (Fragrance)', 'Flavor/Aroma', 'Vanillin', 'Glycerin'];
    expect(findFragrance(list).map((m) => m.ingredient)).toEqual(['Parfum (Fragrance)', 'Flavor/Aroma', 'Vanillin']);
  });
});

describe('fragrance allergens', () => {
  it('matches the EU-labelled names, including with a parenthetical', () => {
    const m = findFragranceAllergens(['Limonene', 'Linalool*', 'Benzyl Alcohol', 'Benzyl Glycol', 'Citronellol (Natural)']);
    expect(m.map((x) => x.ingredient)).toEqual(['Limonene', 'Linalool*', 'Benzyl Alcohol', 'Citronellol (Natural)']);
    expect(m[2]!.note).toMatch(/preservative/);
  });
});

describe('essential oils', () => {
  it('counts distilled and peel oils but not pressed seed oils', () => {
    const list = [
      'Mentha Piperita (Peppermint) Oil',
      'Citrus Aurantium Bergamia (Bergamot) Fruit Oil',
      'Melaleuca Alternifolia (Tea Tree) Leaf Oil',
      'Rosa Canina Fruit Oil',
      'Rosa Rubiginosa Seed Oil',
      'Olea Europaea (Olive) Fruit Oil',
      'Helianthus Annuus (Sunflower) Seed Oil',
      'Hydrogenated Castor Oil',
    ];
    expect(findEssentialOils(list).map((m) => m.ingredient)).toEqual([
      'Mentha Piperita (Peppermint) Oil',
      'Citrus Aurantium Bergamia (Bergamot) Fruit Oil',
      'Melaleuca Alternifolia (Tea Tree) Leaf Oil',
    ]);
  });
});

describe('daisy family', () => {
  it('finds Asteraceae genera and explains refined seed oils', () => {
    const m = findAsteraceae(['Calendula Officinalis Flower Extract', 'Helianthus Annuus (Sunflower) Seed Oil', 'Centella Asiatica Extract']);
    expect(m.map((x) => x.ingredient)).toEqual(['Calendula Officinalis Flower Extract', 'Helianthus Annuus (Sunflower) Seed Oil']);
    expect(m[0]!.note).toBeUndefined();
    expect(m[1]!.note).toMatch(/Refined seed oils/);
  });
});

describe('named ingredients', () => {
  it('matches whole words, ignoring case and a trailing full stop', () => {
    const list = ['Alcohol Denat.', 'Cetearyl Alcohol', 'Lanolin', 'Lanolin Alcohol'];
    expect(findNamedIngredient(list, 'alcohol denat.').map((m) => m.ingredient)).toEqual(['Alcohol Denat.']);
    expect(findNamedIngredient(list, 'Lanolin').map((m) => m.ingredient)).toEqual(['Lanolin', 'Lanolin Alcohol']);
    expect(findNamedIngredient(list, 'lan')).toEqual([]);
  });
  it('treats regex characters as plain text', () => {
    expect(findNamedIngredient(['CI 77491 (Iron Oxides)'], 'CI 77491 (Iron')).toHaveLength(1);
  });
});

describe('listContains', () => {
  it('compares exact entries, ignoring case and spacing', () => {
    expect(listContains(['Centella Asiatica Leaf Extract'], 'centella  asiatica leaf extract')).toBe(true);
    expect(listContains(['Centella Asiatica Leaf Extract'], 'Centella Asiatica')).toBe(false);
  });
});
