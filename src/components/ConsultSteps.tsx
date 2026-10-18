import Link from 'next/link';
import styles from './ConsultSteps.module.css';

export type StepKey = 'consent' | 'photo' | 'analysis' | 'goals' | 'shortlist';

const STEPS: { key: StepKey; label: string; href: string }[] = [
  { key: 'consent', label: 'Agree', href: '/consult' },
  { key: 'photo', label: 'Photo', href: '/consult/photo' },
  { key: 'analysis', label: 'Analysis', href: '/consult/analysis' },
  { key: 'goals', label: 'Goals', href: '/consult/goals' },
  { key: 'shortlist', label: 'Shortlist', href: '/shortlist' },
];

/** The consultation is a real sequence, so its steps are numbered. Completed steps stay reachable. */
export function ConsultSteps({ current, done }: { current: StepKey; done: StepKey[] }) {
  return (
    <nav aria-label="Consultation steps" className={styles.steps}>
      <ol>
        {STEPS.map((s, i) => {
          const isCurrent = s.key === current;
          const isDone = done.includes(s.key);
          return (
            <li key={s.key} className={`${isCurrent ? styles.current : ''} ${isDone ? styles.done : ''}`}>
              {isDone && !isCurrent ? (
                <Link href={s.href}>
                  <span className={styles.no}>{i + 1}</span> {s.label}
                </Link>
              ) : (
                <span aria-current={isCurrent ? 'step' : undefined}>
                  <span className={styles.no}>{i + 1}</span> {s.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
