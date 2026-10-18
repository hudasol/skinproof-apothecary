import type { Metadata } from 'next';
import { SpecimenSheet } from '@/components/SpecimenSheet';
import { getCatalogue } from '@/lib/catalogue';
import { botanicalCounts, evidenceByPreparation } from '@/lib/catalogue/facts';
import { GOAL_LABELS } from '@/lib/domain/skin';
import { GRADE_ORDER } from '@/lib/ledger/engine';
import { GRADE_LABEL } from '@/lib/view';
import styles from './library.module.css';

export const metadata: Metadata = { title: 'Botanical library' };

export default function LibraryPage() {
  const cat = getCatalogue();
  const entries = cat.botanicals
    .map((b) => {
      const prep = evidenceByPreparation(cat, b.id);
      const best = prep
        .flatMap((p) => p.goals.map((g) => ({ ...g, prep: p.label })))
        .sort((a, b2) => GRADE_ORDER[b2.grade] - GRADE_ORDER[a.grade])[0];
      return { b, counts: botanicalCounts(cat, b.id), best };
    })
    .sort((a, b) => (b.best ? GRADE_ORDER[b.best.grade] : 0) - (a.best ? GRADE_ORDER[a.best.grade] : 0) || a.b.commonName.localeCompare(b.b.commonName));

  return (
    <div className="wrap page">
      <header className="page-head">
        <h1>Botanical library</h1>
        <p>
          Twelve plants that appear on botanical skincare labels, with every topical study we could verify. Each is graded by the
          preparation that was actually tested: a leaf extract and a seed oil from the same plant are different things.
        </p>
      </header>
      <ul className={styles.grid}>
        {entries.map(({ b, counts, best }) => (
          <li key={b.id}>
            <SpecimenSheet
              size="small"
              botanical={b}
              href={`/library/${b.id}`}
              lines={[
                { term: 'Studies', value: `${counts.studies} (${counts.human} in people)` },
                { term: 'Best grade', value: best ? `${GRADE_LABEL[best.grade]}, ${GOAL_LABELS[best.goal].short.toLowerCase()}` : 'None' },
              ]}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
