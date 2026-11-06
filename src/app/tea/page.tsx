import type { Metadata } from 'next';
import Link from 'next/link';
import { getTeas } from '@/lib/catalogue/teas';
import type { Tea, TeaTier } from '@/lib/catalogue/tea-schema';
import { GOAL_LABELS, GOALS, type Goal } from '@/lib/domain/skin';
import { personalContext } from '@/lib/personal';
import { planTea } from '@/lib/tea/plan';
import styles from './tea.module.css';

export const metadata: Metadata = { title: 'Herbal teas' };

const TIER_LABEL: Record<TeaTier, string> = {
  human_trial: 'Tried in people',
  traditional: 'Traditional use only',
  tested_not_helpful: 'Tested, did not help',
};
const TIER_HELP: Record<TeaTier, string> = {
  human_trial: 'At least one trial in people measured a skin change. See what was actually taken below.',
  traditional: 'Used in herbal traditions. We found no trial on skin, so this is comfort, not evidence.',
  tested_not_helpful: 'Trials looked and found little or no benefit for this goal.',
};
const TAKEN_AS: Record<string, string> = {
  brewed_drink: 'a drink',
  oral_powder: 'a powder to eat, not a tea',
  oral_extract: 'a capsule or extract, not a tea',
  oral_extract_with_cream: 'a cream plus a capsule, not a tea',
};
const PART: Record<Tea['part'], string> = { flower: 'Flower', leaf: 'Leaf', root: 'Root', fruit: 'Fruit', calyx: 'Flower (calyx)', aerial_parts: 'Leaf and stem' };

function parseGoals(raw: string | string[] | undefined): Goal[] {
  const list = (Array.isArray(raw) ? raw.join(',') : (raw ?? '')).split(',').map((s) => s.trim());
  return GOALS.filter((g) => list.includes(g)).slice(0, 4);
}

export default async function TeaPage({ searchParams }: { searchParams: Promise<{ goals?: string | string[] }> }) {
  const teas = getTeas();
  const { consultation } = await personalContext();
  const profile = consultation?.profile ?? null;
  const fromUrl = parseGoals((await searchParams).goals);
  const goals: Goal[] = fromUrl.length ? fromUrl : (profile?.goals ?? []);
  const source = fromUrl.length ? 'chosen' : profile ? 'consultation' : 'none';
  const avoidDaisyFamily = !!profile?.constraints.avoidAsteraceae || !!profile?.makeupConstraints?.avoidAsteraceae;
  const plan = planTea(teas, goals, { avoidDaisyFamily });
  const evidenceOf = (tea: Tea, id: string) => tea.evidence.find((e) => e.id === id)!;

  return (
    <div className="wrap page">
      <header className="page-head">
        <h1>Herbal teas for your focus areas</h1>
        <p>
          Pick the areas you are working on, for example low moisture, and see which flowers, leaves and roots have been used or tested as a
          drink or by mouth, then one blend that covers them. Tea is a gentle extra. It does not replace skincare, and it is not medicine.
        </p>
      </header>

      <div className={styles.honest}>
        <strong>Read this first.</strong> Very few teas have ever been tested on skin. Where a trial used a capsule, a powder or a branded drink
        instead of a home brewed tea, we say so. A tea with only “traditional use” is shown for comfort, with the source that describes it.
        A missing caution means we found none, not that none exist.
      </div>

      <form method="get" className={styles.picker}>
        <fieldset>
          <legend>
            Your focus areas
            {source === 'consultation' && <span className="small"> (from your consultation; change them here)</span>}
          </legend>
          <div className={styles.goalGrid}>
            {GOALS.map((g) => (
              <label key={g} className={styles.goal}>
                <input type="checkbox" name="goals" value={g} defaultChecked={goals.includes(g)} /> {GOAL_LABELS[g].label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="actions">
          <button type="submit" className="btn">
            Show teas and a blend
          </button>
          {!profile && (
            <Link href="/consult" className="btn quiet">
              Start a consultation to find your areas
            </Link>
          )}
        </div>
        <p className="small">Up to four areas. The form sends them in the address, so you can bookmark the page.</p>
      </form>

      {avoidDaisyFamily && (
        <p className="notice">
          You told us you avoid daisy family plants, so chamomile, dandelion and burdock are left out of this page’s suggestions.
        </p>
      )}

      {goals.length === 0 && <p className="section">Choose at least one area above to see suggestions.</p>}

      {plan.goals.map((gp) => (
        <section key={gp.goal} className="section" aria-labelledby={`g-${gp.goal}`}>
          <h2 id={`g-${gp.goal}`}>{GOAL_LABELS[gp.goal].label}</h2>
          {gp.options.length === 0 && (
            <p>
              No herbal tea has been tested or traditionally used for this goal in the sources we reviewed. The{' '}
              <Link href="/library">botanical library</Link> and your <Link href="/shortlist">shortlist</Link> cover it better.
            </p>
          )}
          <ul className={styles.cards}>
            {gp.options.map((o) => (
              <li key={o.tea.id} className={`${styles.card} ${styles[o.tier]}`}>
                <div className={styles.cardHead}>
                  <h3>
                    {o.tea.commonName} <span className={styles.part}>{PART[o.tea.part]}</span>
                  </h3>
                  <span className={`${styles.tier} ${styles[`tier_${o.tier}`]}`} title={TIER_HELP[o.tier]}>
                    {TIER_LABEL[o.tier]}
                  </span>
                </div>
                <p className="small">
                  <em>{o.tea.scientificName}</em>
                </p>
                <p>
                  <strong>{o.headline}</strong>
                </p>
                <p className="small">{o.detail}</p>
                {o.evidenceIds.length > 0 && (
                  <details className="fold">
                    <summary>The evidence ({o.evidenceIds.length})</summary>
                    <div className="fold-body">
                      {o.evidenceIds.map((id) => {
                        const e = evidenceOf(o.tea, id);
                        return (
                          <div key={id} className={styles.evidence}>
                            <p className="small">
                              <a href={e.citation.url}>
                                {e.citation.authors} {e.citation.title}
                              </a>{' '}
                              {e.citation.journal}, {e.citation.year}. PMID {e.citation.pmid}.
                            </p>
                            <p className="small">
                              <strong>What people took:</strong> {TAKEN_AS[e.taken_as]}. {e.population}
                              {e.durationWeeks ? `, ${Math.round(e.durationWeeks)} weeks` : ''}.
                            </p>
                            <p className="small">{e.summary}</p>
                            <p className="small muted">
                              <strong>Limits:</strong> {e.limitations}
                              {e.funding ? ` Funding: ${e.funding}` : ''}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
                {o.sources.length > 0 && (
                  <p className="small muted">
                    Source:{' '}
                    {o.sources.map((s, i) => (
                      <span key={s.url}>
                        {i > 0 && '; '}
                        <a href={s.url}>{s.title}</a>
                      </span>
                    ))}
                  </p>
                )}
                {o.tea.cautions.length > 0 && (
                  <ul className={styles.cautions}>
                    {o.tea.cautions.map((c) => (
                      <li key={c.note} className="small">
                        <strong>Before you drink it:</strong> {c.note} <a href={c.source.url}>Source</a>
                      </li>
                    ))}
                  </ul>
                )}
                {!o.tea.blend.eligible && <p className="small muted">Not used in the blend: {o.tea.blend.reason}</p>}
              </li>
            ))}
          </ul>
          {gp.excluded.length > 0 && (
            <p className="small muted">
              Left out for you: {gp.excluded.map((e) => `${e.tea.commonName} (${e.reason.toLowerCase()})`).join('; ')}
            </p>
          )}
        </section>
      ))}

      {goals.length > 0 && (
        <section className={`section ${styles.blend}`} aria-labelledby="blend">
          <h2 id="blend">Your blend</h2>
          {plan.blend.length ? (
            <>
              <p>
                One cup that draws on {plan.blend.length} {plan.blend.length === 1 ? 'plant' : 'plants'}, chosen to cover as many of your areas
                as the evidence allows.
              </p>
              <ul className={styles.blendList}>
                {plan.blend.map((b) => (
                  <li key={b.tea.id}>
                    <strong>{b.tea.commonName}</strong> <span className={styles.part}>{PART[b.tea.part]}</span>
                    <span className="small" style={{ display: 'block' }}>
                      For {b.covers.map((c) => `${GOAL_LABELS[c.goal].short.toLowerCase()} (${TIER_LABEL[c.tier].toLowerCase()})`).join(', ')}.
                    </span>
                  </li>
                ))}
              </ul>
              <p className="small">
                <strong>How to make it.</strong> Mix small, equal portions of the dried plants, steep in hot water and taste. Adjust to
                suit you. We give no amounts because no study tested these plants together, so this blend is SkinProof’s suggestion, not a
                tested recipe.
              </p>
              {plan.uncovered.length > 0 && (
                <p className="small">
                  Not covered by the blend:{' '}
                  {plan.uncovered.map((u) => `${GOAL_LABELS[u.goal].short.toLowerCase()} (${u.reason})`).join(' ')}
                </p>
              )}
            </>
          ) : (
            <p>
              No tea qualifies for a blend for these areas. {plan.uncovered.map((u) => u.reason).filter((r, i, a) => a.indexOf(r) === i).join(' ')}
            </p>
          )}
          <div className={styles.check}>
            <h3>Check before you sip</h3>
            <ul className="small">
              <li>If you are pregnant or breastfeeding, ask your clinician first. Most of these plants have not been studied in pregnancy.</li>
              <li>If you take blood pressure medicine or warfarin, or have liver disease, read the caution on each plant above and ask your clinician.</li>
              <li>Stop if you notice a rash, itching or swelling, and seek care if it is severe.</li>
              <li>Drinking water and a moisturiser do more for dry skin than any tea.</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
