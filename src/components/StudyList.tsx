import type { Study } from '@/lib/catalogue/schema';
import { GOAL_LABELS, type Goal } from '@/lib/domain/skin';
import { DESIGN_LABEL, SETTING_LABEL } from '@/lib/view';
import styles from './StudyList.module.css';

const FINDING: Record<Study['outcomes'][number]['finding'], string> = {
  supports: 'Supports',
  no_effect: 'No effect found',
  mixed: 'Mixed result',
};

/** Studies as citable records: design, setting, what was applied, what was found, and its limits. */
export function StudyList({ studies, goal, highlight }: { studies: Study[]; goal?: Goal; highlight?: Set<string> }) {
  return (
    <ol className={styles.list}>
      {studies.map((s) => {
        const outcomes = goal ? s.outcomes.filter((o) => o.goal === goal) : s.outcomes;
        const counted = s.setting !== 'medical' && !['in_vitro', 'animal'].includes(s.design);
        return (
          <li key={s.id} id={s.id} className={`${styles.study} ${highlight?.has(s.id) ? styles.basis : ''}`}>
            <p className={styles.cite}>
              <a href={s.citation.url} rel="noopener noreferrer" target="_blank">
                {s.citation.title}
              </a>
              <span className={styles.source}>
                {' '}
                {s.citation.authors}. <em>{s.citation.journal}</em>, {s.citation.year}.{s.citation.pmid ? ` PubMed ${s.citation.pmid}.` : ''}
              </span>
            </p>
            <dl className={styles.meta}>
              <div>
                <dt>Design</dt>
                <dd>
                  {DESIGN_LABEL[s.design]}
                  {s.n ? `, ${s.n} people` : ''}
                  {s.durationWeeks ? `, ${s.durationWeeks} weeks` : ''}
                </dd>
              </div>
              <div>
                <dt>Setting</dt>
                <dd>{SETTING_LABEL[s.setting]}</dd>
              </div>
              <div>
                <dt>Compared with</dt>
                <dd>{s.control}</dd>
              </div>
              <div>
                <dt>What was applied</dt>
                <dd>{s.preparationText}</dd>
              </div>
              <div>
                <dt>Isolates the botanical</dt>
                <dd>{s.isolatesBotanical ? 'Yes' : 'No: a multi-ingredient product was tested as a whole'}</dd>
              </div>
            </dl>
            <ul className={styles.outcomes}>
              {outcomes.map((o) => (
                <li key={o.goal}>
                  <span className={`${styles.finding} ${styles[o.finding]}`}>{FINDING[o.finding]}</span>{' '}
                  <span className={styles.goal}>{GOAL_LABELS[o.goal].short}:</span> {o.summary}
                </li>
              ))}
            </ul>
            <p className={styles.limits}>
              <strong>Limits.</strong> {s.limitations}
              {s.funding ? ` Funding and affiliations: ${s.funding}` : ''}
            </p>
            {!counted && <p className={styles.notCounted}>Shown for completeness; not counted towards a cosmetic grade.</p>}
          </li>
        );
      })}
    </ol>
  );
}
