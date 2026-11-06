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
import { readScores, standingWords } from '@/lib/domain/reading';
import { CONCERN_LABELS, CONCERN_TO_GOAL, GOAL_LABELS, SKIN_TYPE_PLAIN, suggestFocus } from '@/lib/domain/skin';
import { maskNotes } from '@/lib/services/mask-notes';
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

      {a.status === 'succeeded' && a.result && await (async () => {
        const result = a.result!;
        const focus = suggestFocus(result);
        const focusConcerns = new Set(focus.map((f) => f.concern));
        const sorted = result.scores.slice().sort((x, y) => x.rawScore - y.rawScore);
        const reading = readScores(result);
        const notes = a.providerMode === 'live' ? await maskNotes(db, result.scores) : {};
        const lowThree = reading.scores.slice(0, 3);
        const masks = photo
          ? sorted.filter((s) => s.maskArtifactId).map((s) => ({ concern: s.concern, label: CONCERN_LABELS[s.concern].label, url: `/api/artifacts/${s.maskArtifactId}` }))
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
                {Object.keys(result.skinType).length > 0 ? (
                  <div className={styles.skinType} aria-labelledby="skintype">
                    <h2 id="skintype">Your skin type</h2>
                    <ul className={styles.skinTypeList}>
                      {(Object.entries(result.skinType) as [keyof typeof ZONE_LABEL, string][]).map(([zone, t]) => (
                        <li key={zone}>
                          <span className="small">{ZONE_LABEL[zone]}</span>
                          <strong>{t}</strong>
                          <span className="small">{SKIN_TYPE_PLAIN[t as keyof typeof SKIN_TYPE_PLAIN] ?? ''}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="small">
                      This is how the model classed your skin in this one photo, not a diagnosis. It is shown for your information and does not
                      change which products are eligible.
                    </p>
                  </div>
                ) : (
                  <div className={styles.skinType}>
                    <h2>Your skin type</h2>
                    <p className="small">
                      {a.providerMode === 'live'
                        ? 'The model did not return a skin type for this photo. Try again in even daylight with no makeup.'
                        : 'Skin type is not available in the offline demo analysis.'}
                    </p>
                  </div>
                )}

                <h2 id="scores" style={{ marginTop: 'var(--space-6)' }}>Your scores, lowest first</h2>
                <p className="small">
                  <strong>How to read this.</strong> Each row is one thing the model looked at. The dot shows its score from 1 to 100, where
                  a higher score means the model rated that area healthier. The thin vertical line is <em>your own average</em> ({Math.round(reading.average)}).
                  A dot to the left of the line is lower than your other areas; a dot to the right is higher. YouCam publishes no cut off for a
                  good or poor score, so compare areas with each other, not with a target.
                </p>
                <ol className={styles.chart}>
                  {reading.scores.map((s) => (
                    <li key={s.concern} className={`${styles.chartRow} ${focusConcerns.has(s.concern) ? styles.focus : ''}`}>
                      <span className={styles.chartName}>
                        {CONCERN_LABELS[s.concern].label}
                        {focusConcerns.has(s.concern) && <span className={styles.focusTag}>Suggested focus</span>}
                        <span className={styles.chartPlain}>{CONCERN_LABELS[s.concern].plain}</span>
                      </span>
                      <span className={styles.track}>
                        <span className={styles.avg} style={{ left: `${reading.average}%` }} />
                        <span className={styles.dot} style={{ left: `${s.rawScore}%` }} />
                      </span>
                      <span className={styles.value}>
                        <strong>{Math.round(s.rawScore)}</strong>
                        <span className={styles.delta}>{s.standing === 'near' ? 'near average' : `${s.delta < 0 ? '−' : '+'}${Math.abs(Math.round(s.delta))}`}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className={styles.axis} aria-hidden="true">
                  <span />
                  <span className={styles.axisLabels}>
                    <span>1 lower</span>
                    <span>50</span>
                    <span>100 healthier</span>
                  </span>
                  <span />
                </div>

                <div className={styles.readingNote}>
                  <h3>In plain words</h3>
                  {reading.lowest && reading.highest && (
                    <p>
                      Your lowest score is <strong>{CONCERN_LABELS[reading.lowest.concern].label.toLowerCase()}</strong> ({Math.round(reading.lowest.rawScore)},{' '}
                      {standingWords(reading.lowest)}) and your highest is <strong>{CONCERN_LABELS[reading.highest.concern].label.toLowerCase()}</strong> (
                      {Math.round(reading.highest.rawScore)}). Across your {reading.scores.length} scores the average is {Math.round(reading.average)}.
                    </p>
                  )}
                  {lowThree.length > 0 && (
                    <ul className="small">
                      {lowThree.map((s) => (
                        <li key={s.concern}>
                          <strong>{CONCERN_LABELS[s.concern].label}</strong>: {CONCERN_LABELS[s.concern].plain.replace(/\.$/, '')}.{' '}
                          {notes[s.concern]
                            ? `In your photo the model marked ${notes[s.concern]}.`
                            : a.providerMode === 'live'
                              ? 'The model returned no map for this area, so we cannot say where.'
                              : 'The offline demo draws no map, so there is no location to point to.'}
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.providerMode === 'live' && masks.length > 0 && <p className="small">Use the photo on the right to see each marked area, one at a time.</p>}
                </div>
                {result.missing.length > 0 && (
                  <p className="small" style={{ marginTop: 'var(--space-4)' }}>
                    Not returned for this photo: {result.missing.map((m) => (m === 'skin_type' ? 'skin type' : CONCERN_LABELS[m].label.toLowerCase())).join(', ')}.
                    Missing scores are left out, not guessed.
                  </p>
                )}
              </section>
              <aside>
                <h3>Where to focus</h3>
                {focus.length ? (
                  <>
                    <p className="small">
                      We take your three lowest scores that match a goal and suggest working on those first. “Where to focus” means the areas where
                      the model scored you lowest compared with your own other scores. It does not mean something is wrong. You can change these
                      on the next step.
                    </p>
                    <ol className={styles.suggest}>
                      {focus.map((f, i) => {
                        const r = reading.scores.find((x) => x.concern === f.concern);
                        return (
                          <li key={f.goal}>
                            <span className="small">Focus {i + 1}</span>
                            <strong>{GOAL_LABELS[f.goal].label}</strong>
                            <span className="small" style={{ display: 'block' }}>
                              Because {CONCERN_LABELS[f.concern].label.toLowerCase()} scored {Math.round(f.rawScore)}
                              {r ? `, ${standingWords(r)}` : ''}.
                            </span>
                          </li>
                        );
                      })}
                    </ol>
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
                    <MaskViewer photoUrl={`/api/artifacts/${photo.id}`} masks={masks} initial={focus[0]?.concern} />
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
