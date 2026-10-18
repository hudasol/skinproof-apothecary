import type { Metadata } from 'next';
import Link from 'next/link';
import { BotanicalPlate } from '@/components/BotanicalPlate';
import { OutcomeMark } from '@/components/marks';
import { getBotanical, getCatalogue } from '@/lib/catalogue';
import { CATEGORY_LABELS, PRODUCT_CATEGORIES, type ProductCategory } from '@/lib/domain/profile';
import { assessmentFor, personalContext } from '@/lib/personal';
import styles from './products.module.css';

export const metadata: Metadata = { title: 'Apothecary' };

const VERIFIED_LABEL = { verified: 'Label verified', partial: 'Label partly verified', unverified: 'Label not verified' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const category = (PRODUCT_CATEGORIES as readonly string[]).includes(type ?? '') ? (type as ProductCategory) : null;
  const all = getCatalogue().products.filter((p) => p.shelf === 'skincare');
  const products = (category ? all.filter((p) => p.category === category) : all).slice().sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
  const present = PRODUCT_CATEGORIES.filter((c) => all.some((p) => p.category === c));
  const { decision } = await personalContext();

  return (
    <div className="wrap page">
      <header className="page-head">
        <h1>Apothecary</h1>
        <p>
          Every skincare product in the catalogue, including the ones the Ledger sets aside. Each has a dossier with its published
          ingredient list and the evidence for what it contains.
        </p>
        {!decision && (
          <p className="small">
            <Link href="/consult">Start a consultation</Link> to see which of these fit your goals and exclusions.
          </p>
        )}
      </header>
      <nav aria-label="Filter by type" className={styles.filters}>
        <Link href="/products" className={styles.filter} aria-current={!category ? 'true' : undefined}>
          All ({all.length})
        </Link>
        {present.map((c) => (
          <Link key={c} href={`/products?type=${c}`} className={styles.filter} aria-current={category === c ? 'true' : undefined}>
            {CATEGORY_LABELS[c]} ({all.filter((p) => p.category === c).length})
          </Link>
        ))}
      </nav>
      {products.length === 0 ? (
        <p className="notice">
          No products of this type. <Link href="/products">Show all products</Link>
        </p>
      ) : (
        <ul className={styles.shelf}>
          {products.map((p) => {
            const lead = p.botanicals[0] ? getBotanical(p.botanicals[0].botanicalId) : undefined;
            const mine = assessmentFor(decision, p.id);
            const names = [...new Set(p.botanicals.map((b) => getBotanical(b.botanicalId)!.commonName.split(' / ')[0]))];
            return (
              <li key={p.id} className={styles.row}>
                <div className={styles.thumb}>{lead && <BotanicalPlate id={lead.id} title="" />}</div>
                <div>
                  <Link href={`/products/${p.id}`} className={styles.rowName}>
                    {p.brand} {p.name}
                  </Link>
                  <p className={styles.rowMeta}>
                    {CATEGORY_LABELS[p.category]}
                    {names.length ? `. Botanicals: ${names.join(', ')}` : '. No catalogue botanicals'}
                  </p>
                </div>
                <div className={styles.rowStatus}>
                  {mine && <OutcomeMark outcome={mine.outcome} short />}
                  <span className="small">{VERIFIED_LABEL[p.verification]}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
