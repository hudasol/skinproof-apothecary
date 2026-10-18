import type { Metadata } from 'next';
import Link from 'next/link';
import { getCatalogue } from '@/lib/catalogue';
import { EMPTY_CONSTRAINTS } from '@/lib/domain/profile';
import { checkColourShade } from '@/lib/ledger/engine';
import { personalContext } from '@/lib/personal';
import styles from './colour.module.css';

export const metadata: Metadata = { title: 'Lip colour' };

export default async function ColourPage() {
  const products = getCatalogue().products.filter((p) => p.shelf === 'colour');
  const { consultation } = await personalContext();
  const constraints = consultation?.profile?.constraints ?? EMPTY_CONSTRAINTS;

  return (
    <div className="wrap page">
      <header className="page-head">
        <h1>Botanical lip colour</h1>
        <p>
          Tinted balms built on plant oils and waxes, with YouCam’s makeup try-on so you can see a shade on your own face before you buy.
          These are chosen for colour. SkinProof makes no claim about what they do for your lips.
        </p>
        {consultation?.profile && (
          <p className="small">Shades that break the limits you set in your consultation are marked and cannot be tried on.</p>
        )}
      </header>
      <div className={styles.shelf}>
        {products.map((p) => (
          <article key={p.id} className={styles.card}>
            <h2 className={styles.name}>
              <span className={styles.brand}>{p.brand}</span> {p.name}
            </h2>
            <p className="small">{p.description}</p>
            <ul className={styles.swatches} aria-label={`${p.name} shades`}>
              {p.shades.map((s) => {
                const check = checkColourShade(p, s.id, constraints);
                const blocked = check.outcome !== 'passes' || !s.render;
                return (
                  <li key={s.id}>
                    <Link href={`/colour/${p.id}?shade=${s.id}`} className={`${styles.swatch} ${blocked ? styles.blocked : ''}`}>
                      <span className={styles.chip} style={{ background: s.render?.hex ?? 'transparent' }} aria-hidden="true" />
                      <span>
                        <strong>{s.name}</strong>
                        <span className="small">
                          {s.colourWords ?? 'No colour description'}
                          {!s.render ? '. Cannot be previewed: no brand swatch' : check.outcome === 'excluded' ? '. Excluded by your limits' : ''}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link href={`/colour/${p.id}`} className="btn secondary small">
              Open the try-on studio
            </Link>
          </article>
        ))}
      </div>
      <p className="small section">
        Swatch dots show SkinProof’s rendering colour, measured from each brand’s own swatch image. Brands do not publish colour values, so
        these are approximations.
      </p>
    </div>
  );
}
