import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GradeChip } from '@/components/marks';
import { SpecimenSheet } from '@/components/SpecimenSheet';
import { StudyList } from '@/components/StudyList';
import { getBotanical, getCatalogue, productsContaining, studiesFor } from '@/lib/catalogue';
import { botanicalCounts, evidenceByPreparation } from '@/lib/catalogue/facts';
import { GOAL_LABELS } from '@/lib/domain/skin';
import { formatDate } from '@/lib/view';
import styles from '../library.module.css';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const b = getBotanical((await params).id);
  return { title: b ? b.commonName : 'Botanical' };
}

export default async function BotanicalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = getBotanical(id);
  if (!b) notFound();
  const cat = getCatalogue();
  const prep = evidenceByPreparation(cat, id);
  const counts = botanicalCounts(cat, id);
  const studies = studiesFor(id);
  const products = productsContaining(id);

  return (
    <div className="wrap page">
      <p className="small">
        <Link href="/library">Botanical library</Link>
      </p>
      <header className={styles.detailHead}>
        <div>
          <h1>{b.commonName}</h1>
          <p className={styles.sci}>
            {b.scientificName}, {b.family}
          </p>
          <p className="lede">{b.summary}</p>
          <p className="small">
            {counts.studies} studies, {counts.human} in people, {counts.isolatingTrials} randomised cosmetic{' '}
            {counts.isolatingTrials === 1 ? 'trial' : 'trials'} that isolate it. Reviewed {formatDate(b.reviewedOn)}.
          </p>
        </div>
        <SpecimenSheet size="small" botanical={b} lines={[]} />
      </header>

      <section aria-labelledby="by-prep">
        <h2 id="by-prep">Evidence by preparation</h2>
        <p>
          Grades follow the <Link href="/ledger#E1_grade">Ledger’s published rule</Link>. A product only benefits from a row if it
          contains that same preparation.
        </p>
        <div className="table-scroll">
          <table className={`register ${styles.matrix}`}>
            <thead>
              <tr>
                <th scope="col">Preparation studied</th>
                <th scope="col">Goal</th>
                <th scope="col">Grade</th>
                <th scope="col">Studies</th>
              </tr>
            </thead>
            <tbody>
              {prep.flatMap((p) =>
                p.goals.map((g, i) => (
                  <tr key={`${p.label}-${g.goal}`}>
                    <td>{i === 0 ? p.label : ''}</td>
                    <td>{GOAL_LABELS[g.goal].label}</td>
                    <td>
                      <GradeChip grade={g.grade} explain />
                    </td>
                    <td>
                      {g.studies.map((s, k) => (
                        <span key={s.id}>
                          {k > 0 && ', '}
                          <a href={`#${s.id}`}>
                            {s.citation.authors.split(' ')[0]} {s.citation.year}
                          </a>
                        </span>
                      ))}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="aside-layout section">
        <section aria-labelledby="studies">
          <h2 id="studies">The studies</h2>
          <StudyList studies={studies} />
        </section>
        <aside>
          <h3>On labels as</h3>
          <ul className={styles.labelNames}>
            {b.inciNames.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <h3 style={{ marginTop: 'var(--space-6)' }}>Safety notes</h3>
          {b.safetyNotes.length ? (
            <ul className={styles.safety}>
              {b.safetyNotes.map((n) => (
                <li key={n.note} className="small">
                  {n.note}{' '}
                  <a href={n.source.url} rel="noopener noreferrer" target="_blank">
                    Source
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small">No sourced safety notes recorded.</p>
          )}
          <h3 style={{ marginTop: 'var(--space-6)' }}>In the apothecary</h3>
          {products.length ? (
            <ul className="small">
              {products.map((p) => (
                <li key={p.id}>
                  <Link href={`/products/${p.id}`}>
                    {p.brand} {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small">No catalogue product lists it.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
