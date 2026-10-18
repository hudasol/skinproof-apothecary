import Link from 'next/link';
import { getStudy } from '@/lib/catalogue';
import type { Factor } from '@/lib/ledger/types';
import { STAGE_OF_RULE, STAGES, citationShort } from '@/lib/view';
import styles from './DecisionTrail.module.css';

const EFFECT_LABEL: Record<Factor['effect'], string> = {
  excludes: 'Excludes',
  blocks: 'Stops here',
  qualifies: 'Qualifies',
  cautions: 'Caution',
  informs: 'Noted',
  ranks: 'Ranked',
};

/**
 * The factors that produced one product's outcome, in the order the Ledger
 * checks them. A stage the product never reached is shown as not reached.
 */
export function DecisionTrail({ factors }: { factors: Factor[] }) {
  const byStage = STAGES.map((name, i) => ({ name, no: i + 1, factors: factors.filter((f) => STAGE_OF_RULE[f.rule] === i + 1) }));
  const lastReached = Math.max(0, ...factors.map((f) => STAGE_OF_RULE[f.rule]));
  const stopped = factors.some((f) => f.effect === 'excludes' || f.effect === 'blocks');
  return (
    <ol className={styles.trail}>
      {byStage.map((s) => {
        const notReached = stopped && s.no > lastReached;
        const passedQuietly = !notReached && s.factors.length === 0;
        return (
          <li key={s.no} className={`${styles.stage} ${notReached ? styles.notReached : ''}`}>
            <div className={styles.stageHead}>
              <span className={styles.no}>{s.no}</span>
              <span className={styles.name}>{s.name}</span>
            </div>
            {notReached && <p className={styles.quiet}>Not reached.</p>}
            {passedQuietly && <p className={styles.quiet}>{s.no === 1 ? 'Nothing on the label matches your exclusions.' : 'Passed.'}</p>}
            {s.factors.length > 0 && (
              <ul className={styles.factors}>
                {s.factors.map((f, i) => (
                  <li key={i} className={styles[f.effect]}>
                    <span className={styles.effect}>{EFFECT_LABEL[f.effect]}</span>
                    <span>
                      {f.ingredient && <strong className={styles.ingredient}>{f.ingredient}. </strong>}
                      {f.message}
                      {f.sources && f.sources.length > 0 && (
                        <span className={styles.sources}>
                          {' '}
                          {f.sources.map((src, k) => {
                            const study = getStudy(src);
                            return (
                              <span key={src}>
                                {k > 0 && '; '}
                                {study ? (
                                  <Link href={`/library/${study.botanicalId}#${study.id}`}>{citationShort(study)}</Link>
                                ) : (
                                  <a href={src} rel="noopener noreferrer" target="_blank">
                                    source
                                  </a>
                                )}
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
