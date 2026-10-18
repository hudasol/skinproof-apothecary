import { splitIngredients } from '@/lib/catalogue/ingredients';
import type { Product } from '@/lib/catalogue/schema';
import { readLabel } from '@/lib/ledger/engine';
import styles from './IngredientLabel.module.css';

/**
 * The ingredient list exactly as published, with SkinProof's readings marked
 * on it: catalogue botanicals, scent materials and allergens, essential oils,
 * daisy-family plants. Order is the label's; nothing is inferred from it.
 */
export function IngredientLabel({ product, verbatim, title = 'Ingredients as published' }: { product: Product; verbatim: string; title?: string }) {
  const reading = readLabel(verbatim);
  const tokens = splitIngredients(verbatim);
  const botanical = new Set(product.botanicals.map((b) => b.inci.toLowerCase()));
  const scent = new Set([...reading.fragrance, ...reading.allergens].map((m) => m.ingredient));
  const eo = new Set(reading.essentialOils.map((m) => m.ingredient));
  const daisy = new Set(reading.asteraceae.map((m) => m.ingredient));
  const legend = [
    { cls: styles.botanical, label: 'Catalogue botanical', n: tokens.filter((t) => botanical.has(t.toLowerCase())).length },
    { cls: styles.scent, label: 'Fragrance, scent material or labelled allergen', n: scent.size },
    { cls: styles.eo, label: 'Essential oil', n: eo.size },
    { cls: styles.daisy, label: 'Daisy family (Asteraceae)', n: daisy.size },
  ].filter((l) => l.n > 0);

  return (
    <section className={styles.wrap} aria-label={title}>
      <h3 className={styles.title}>{title}</h3>
      {product.actives.length > 0 && (
        <p className={styles.actives}>
          <strong>Active ingredient{product.actives.length > 1 ? 's' : ''}:</strong>{' '}
          {product.actives.map((a) => `${a.name} ${a.percent}%`).join(', ')} <span className="muted">(“{product.actives[0]!.wording}”)</span>
        </p>
      )}
      <p className={styles.list}>
        {tokens.map((t, i) => {
          const cls = [
            botanical.has(t.toLowerCase()) && styles.botanical,
            scent.has(t) && styles.scent,
            eo.has(t) && styles.eo,
            daisy.has(t) && styles.daisy,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <span key={`${t}-${i}`}>
              {cls ? <mark className={cls}>{t}</mark> : t}
              {i < tokens.length - 1 ? ', ' : ''}
            </span>
          );
        })}
      </p>
      {legend.length > 0 && (
        <ul className={styles.legend} aria-label="Key">
          {legend.map((l) => (
            <li key={l.label}>
              <mark className={l.cls}>{l.label}</mark> ({l.n})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
