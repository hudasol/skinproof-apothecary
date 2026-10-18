import type { Applicability, EvidenceGrade, Outcome } from '@/lib/ledger/types';
import { APPLICABILITY_LABEL, GRADE_EXPLAIN, GRADE_LABEL, OUTCOME_LABEL, OUTCOME_SHORT } from '@/lib/view';
import styles from './marks.module.css';

export function OutcomeMark({ outcome, short = false }: { outcome: Outcome; short?: boolean }) {
  return <span className={`mark ${outcome}`}>{short ? OUTCOME_SHORT[outcome] : OUTCOME_LABEL[outcome]}</span>;
}

/** Evidence grade as a five-step scale, so strength reads at a glance without a number. */
export function GradeChip({ grade, explain = false }: { grade: EvidenceGrade; explain?: boolean }) {
  const filled = { strong: 4, moderate: 3, limited: 2, conflicting: 2, not_supported: 0, preclinical: 1, none: 0 }[grade];
  return (
    <span className={styles.grade} title={GRADE_EXPLAIN[grade]}>
      <span className={styles.scale} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`${styles.pip} ${i < filled ? styles.on : ''} ${grade === 'conflicting' && i < filled ? styles.split : ''}`} />
        ))}
      </span>
      <span>{GRADE_LABEL[grade]}</span>
      {explain && <span className="visually-hidden">: {GRADE_EXPLAIN[grade]}</span>}
    </span>
  );
}

export function ApplicabilityChip({ value }: { value: Applicability }) {
  return <span className={`${styles.applic} ${styles[value]}`}>{APPLICABILITY_LABEL[value]}</span>;
}

export function ProvenanceMark({ mode }: { mode: 'live' | 'fixture' }) {
  return mode === 'live' ? <span className="mark live">YouCam result</span> : <span className="mark fixture">Fixture, not YouCam</span>;
}
