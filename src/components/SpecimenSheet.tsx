import Link from 'next/link';
import type { Botanical } from '@/lib/catalogue/schema';
import { BotanicalPlate } from './BotanicalPlate';
import styles from './SpecimenSheet.module.css';

/**
 * A botanical shown as a herbarium sheet: the drawing, and a label card in
 * the corner carrying real catalogue facts instead of collector notes.
 */
export function SpecimenSheet({
  botanical,
  lines,
  href,
  size = 'large',
}: {
  botanical: Botanical;
  lines: { term: string; value: string }[];
  href?: string;
  size?: 'large' | 'small';
}) {
  const label = (
    <div className={styles.label}>
      <p className={styles.binomial}>{botanical.scientificName}</p>
      <p className={styles.common}>
        {botanical.commonName} · {botanical.family}
      </p>
      {lines.length > 0 && (
        <dl className={styles.facts}>
          {lines.map((l) => (
            <div key={l.term}>
              <dt>{l.term}</dt>
              <dd>{l.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
  return (
    <figure className={`${styles.sheet} ${size === 'small' ? styles.small : ''}`}>
      <BotanicalPlate id={botanical.id} title={`Drawing of ${botanical.commonName}`} className={styles.plate} />
      {href ? (
        <Link href={href} className={styles.labelLink}>
          {label}
        </Link>
      ) : (
        label
      )}
    </figure>
  );
}
