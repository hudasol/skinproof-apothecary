import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ConsultSteps } from '@/components/ConsultSteps';
import { RetryForm } from '@/components/forms/RetryForm';
import { JobProgress } from '@/components/JobProgress';
import { MaskViewer } from '@/components/MaskViewer';
import { ProvenanceMark } from '@/components/marks';
import { completedSteps } from '@/lib/consult-progress';
import { getDb } from '@/lib/db/client';
import { CONCERN_LABELS, CONCERN_TO_GOAL, GOAL_LABELS, suggestFocus } from '@/lib/domain/skin';
import { latestAnalysis } from '@/lib/services/analyses';
import { currentPhoto } from '@/lib/services/consultations';
import { currentConsultation } from '@/lib/session';
import { formatDateTime } from '@/lib/view';
import styles from '../consult.module.css';

export const metadata: Metadata = { title: 'Your skin analysis' };

const ZONE_LABEL = { whole: 'Whole face', t_zone: 'T-zone', u_zone: 'Cheeks and jaw (U-zone)' } as const;

export default async function AnalysisPage() {
  const db = getDb();
  const c = await currentConsultation(db);
  if (!c) redirect('/consult');
  const a = latestAnalysis(db, c.id);
  if (!a) redirect(c.analysisConsentAt ? '/consult/photo' : '/consult');
  const photo = currentPhoto(db, c.id);
  const running = ['queued', 'submitting', 'processing', 'downloading'].includes(a.status);

  return (
    <div className="wrap page">
      <ConsultSteps current="analysis" done={completedSteps(db, c)} />
      {running && (
        <>
          <header className="page-head">
            <h1>Reading your photo</h1>
            <p>This usually takes ten to thirty seconds. You can stay on this page; it updates by itself.</p>
          </header>
          <JobProgress url={`/api/analyses/${a.id}`} initial={a.status} title={a.providerMode === 'live' ? 'YouCam Skin AI is working' : 'The fixture analysis is working'} />
        </>
      )}

      {(a.status === 'failed' || a.status === 'interrupted') && a.failure && (
        <>
          <header className="page-head">
            <h1>The analysis could not finish</h1>
          </header>
          <div className="notice error" role="alert">
            <strong>{a.failure.message}</strong>
            {a.failure.guidance && <p>{a.failure.guidance}</p>}
            <p className="small">Nothing was charged for this attempt. Reference: {a.failure.code}.</p>
          </div>
          <div className="actions">
            {a.failure.retryable && photo && <RetryForm />}
            <Link href="/consult/photo" className={a.failure.retryable && photo ? 'btn secondary' : 'btn'}>
              Use a different photo
            </Link>
            <Link href="/consult/goals" className="btn quiet">
              Choose goals without an analysis
            </Link>
          </div>
        </>
      )}

      {a.status === 'succeeded' && a.result && (() => {
        const result = a.result;
        const focus = suggestFocus(result);
        const focusConcerns = new Set(focus.map((f) => f.concern));
        const sorted = result.scores.slice().sort((x, y) => x.rawScore - y.rawScore);
        const masks = photo
          ? result.scores.filter((s) => s.maskArtifactId).map((s) => ({ concern: s.concern, label: CONCERN_LABELS[s.concern].label, url: `/api/artifacts/${s.maskArtifactId}` }))
          : [];
        return (
          <>
            <header className="page-head">
              <div className={styles.resultHead}>
                <h1>What the analysis saw</h1>
                <ProvenanceMark mode={a.providerMode} />
              </div>
              <p>
                {a.providerMode === 'live'
                  ? `YouCam Skin AI scored ${result.scores.length} visible concerns from your photo on ${formatDateTime(a.finishedAt ?? a.createdAt)}.`
                  : 'These are fixture scores, made up from your photo’s bytes so the journey can be shown without YouCam. They say nothing about your skin.'}
              </p>
            </header>
            <div className="aside-layout">
              <section aria-labelledby="scores">
                <h2 id="scores">Scores, lowest first</h2>
                <p className="small">
                  Each dot is the model’s raw score from 1 to 100. Higher means the model rated that area healthier. YouCam publishes no
                  cut-off for “good” or “bad”, so neither do we: compare the scores with each other, not with a target.
                </p>
                <ol className={styles.chart}>
                  {sorted.map((s) => (
                    <li key={s.concern} className={`${styles.chartRow} ${focusConcerns.has(s.concern) ? styles.focus : ''}`}>
                      <span className={styles.chartName}>
                        {CONCERN_LABELS[s.concern].label}
                        {focusConcerns.has(s.concern) && <span className={styles.focusTag}>Suggested focus</span>}
                      </span>
                      <span className={styles.track} title={CONCERN_LABELS[s.concern].plain}>
                        <span className={styles.dot} style={{ left: `${s.rawScore}%` }} />
                      </span>
                      <span className={styles.value}>{Math.round(s.rawScore)}</span>
                    </li>
                  ))}
                </ol>
                <div className={styles.axis} aria-hidden="true">
                  <span />
                  <span className={styles.axisLabels}>
                    <span>1</span>
                    <span>50</span>
                    <span>100</span>
                  </span>
                  <span />
                </div>
                {result.missing.length > 0 && (
                  <p className="small" style={{ marginTop: 'var(--space-4)' }}>
                    Not returned for this photo: {result.missing.map((m) => (m === 'skin_type' ? 'skin type' : CONCERN_LABELS[m].label.toLowerCase())).join(', ')}.
                    Missing scores are left out, not guessed.
                  </p>
                )}
                {Object.keys(result.skinType).length > 0 && (
                  <>
                    <h3 style={{ marginTop: 'var(--space-6)' }}>Skin type, as the model classed it</h3>
                    <ul className="small">
                      {(Object.entries(result.skinType) as [keyof typeof ZONE_LABEL, string][]).map(([zone, t]) => (
                        <li key={zone}>
                          {ZONE_LABEL[zone]}: {t}
                        </li>
                      ))}
                    </ul>
                    <p className="small">Skin type is shown for your information. It does not change which products are eligible.</p>
                  </>
                )}
              </section>
              <aside>
                <h3>Where to focus</h3>
                {focus.length ? (
                  <>
                    <p className="small">Your three lowest scores, relative to each other, point to these goals. You can change them next.</p>
                    <ul className={styles.suggest}>
                      {focus.map((f) => (
                        <li key={f.goal}>
                          <strong>{GOAL_LABELS[f.goal].label}</strong>
                          <span className="small" style={{ display: 'block' }}>
                            From {CONCERN_LABELS[f.concern].label.toLowerCase()}, score {Math.round(f.rawScore)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="small">No score maps to a goal the catalogue covers. Choose your goals yourself.</p>
                )}
                {result.scores.some((s) => CONCERN_TO_GOAL[s.concern] === null) && (
                  <p className="small muted">Under-eye shadow is scored but not used: no catalogue botanical has topical human evidence for it.</p>
                )}
                <Link href="/consult/goals" className="btn" style={{ marginTop: 'var(--space-4)' }}>
                  Choose your goals
                </Link>
                {masks.length > 0 && photo && (
                  <div style={{ marginTop: 'var(--space-6)' }}>
                    <MaskViewer photoUrl={`/api/artifacts/${photo.id}`} masks={masks} />
                  </div>
                )}
              </aside>
            </div>
            <details className="fold section">
              <summary>What SkinProof does not use, and why</summary>
              <div className="fold-body">
                <p>
                  YouCam also returns a “UI score” for each concern, which its documentation says is adjusted upwards to make results feel more
                  positive. SkinProof records it but reasons only with the raw score. It also returns an estimated “skin age” and an overall score;
                  SkinProof does not show either, because the product does not need them and a single number invites a judgement we do not
                  want to make.
                </p>
                <p className="small">
                  Analysis {a.id}, {a.providerLabel}. {a.taskId ? `Provider task ${a.taskId.slice(0, 10)}…` : ''}
                </p>
              </div>
            </details>
          </>
        );
      })()}
    </div>
  );
}
