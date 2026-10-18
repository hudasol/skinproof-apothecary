import type { Metadata } from 'next';
import Link from 'next/link';
import { BotanicalPlate } from '@/components/BotanicalPlate';
import { ConsultSteps } from '@/components/ConsultSteps';
import { ApplicabilityChip, GradeChip, OutcomeMark } from '@/components/marks';
import { getBotanical, getCatalogue, getProduct } from '@/lib/catalogue';
import { completedSteps } from '@/lib/consult-progress';
import { getDb } from '@/lib/db/client';
import { CATEGORY_LABELS } from '@/lib/domain/profile';
import { GOAL_LABELS, GOALS } from '@/lib/domain/skin';
import { evaluate } from '@/lib/ledger/engine';
import type { Outcome, ProductAssessment } from '@/lib/ledger/types';
import { latestAnalysis } from '@/lib/services/analyses';
import { decide } from '@/lib/services/decisions';
import { currentConsultation } from '@/lib/session';
import { formatDateTime, OUTCOME_LABEL } from '@/lib/view';
import styles from './shortlist.module.css';

export const metadata: Metadata = { title: 'Your shortlist' };

const CONSTRAINT_TEXT: Record<string, string> = {
  noFragrance: 'no added fragrance',
  noEssentialOils: 'no essential oils',
  noFragranceAllergens: 'no labelled fragrance allergens',
  avoidAsteraceae: 'no daisy-family plants',
};

const SET_ASIDE: { outcome: Outcome; intro: string }[] = [
  { outcome: 'excluded', intro: 'These break one of your limits. Nothing else about them is weighed.' },
  { outcome: 'limited_evidence', intro: 'Linked to your goals, but only by lab work, null results, or studies of a different preparation.' },
  { outcome: 'unverified', intro: 'No full ingredient list could be traced, so they are never recommended and your limits cannot be checked.' },
  { outcome: 'not_relevant', intro: 'None of their catalogue botanicals has been studied for your goals.' },
];

function firstReason(p: ProductAssessment): string | null {
  const f = p.factors.find((x) => x.effect === 'excludes' || x.effect === 'blocks');
  return f ? `${f.ingredient ? `${f.ingredient}: ` : ''}${f.message}` : null;
}

export default async function ShortlistPage() {
  const db = getDb();
  const c = await currentConsultation(db);
  if (!c?.profile) {
    return (
      <div className="wrap page">
        <ConsultSteps current="shortlist" done={completedSteps(db, c)} />
        <header className="page-head">
          <h1>Your shortlist</h1>
          <p>Your shortlist appears once you have chosen your goals and limits. It takes about two minutes.</p>
        </header>
        <Link href={c ? '/consult/goals' : '/consult'} className="btn">
          {c ? 'Choose your goals' : 'Start a consultation'}
        </Link>
      </div>
    );
  }

  const row = decide(db, c.id);
  const d = row.decision;
  const analysis = latestAnalysis(db, c.id);
  const byOutcome = (o: Outcome) => d.products.filter((p) => p.outcome === o);
  const ranked = d.products.filter((p) => p.rank !== null).sort((a, b) => a.rank! - b.rank!);
  const shortlist = ranked.filter((p) => d.shortlist.includes(p.productId));
  const more = ranked.filter((p) => !d.shortlist.includes(p.productId));
  const limits = [
    ...Object.entries(d.input.constraints)
      .filter(([k, v]) => v === true && CONSTRAINT_TEXT[k])
      .map(([k]) => CONSTRAINT_TEXT[k]!),
    ...d.input.constraints.avoidIngredients.map((i) => `no ${i}`),
  ];
  const alternatives =
    d.status === 'no_match'
      ? GOALS.filter((g) => !d.input.goals.includes(g)).filter(
          (g) => evaluate(getCatalogue(), { ...d.input, goals: [g] }).status === 'shortlist',
        )
      : [];

  return (
    <div className="wrap page">
      <ConsultSteps current="shortlist" done={completedSteps(db, c)} />
      <header className={styles.head}>
        <div>
          <h1>Your shortlist</h1>
          <p className="lede">
            {d.status === 'shortlist'
              ? `${ranked.length} of ${d.products.length} skincare products are eligible for ${d.input.goals.length === 1 ? 'your goal' : 'your goals'}. Here ${shortlist.length === 1 ? 'is the strongest' : `are the ${shortlist.length} strongest`}, in the Ledger’s order.`
              : 'No product in the catalogue is eligible for these goals with these limits. That is a real answer, not an error.'}
          </p>
        </div>
        <dl className={styles.inputs}>
          <div>
            <dt>Goals</dt>
            <dd>
              {d.input.goals.map((g) => GOAL_LABELS[g].label).join('; ')}
              {Object.values(d.goalOrigins).includes('analysis') && <span className="small"> (from your analysis)</span>}
            </dd>
          </div>
          <div>
            <dt>Limits</dt>
            <dd>{limits.length ? limits.join('; ') : 'None'}</dd>
          </div>
          {d.input.reactiveSkin && (
            <div>
              <dt>Also</dt>
              <dd>Your skin reacts easily</dd>
            </div>
          )}
          <div>
            <dd>
              <Link href="/consult/goals">Change these</Link>
            </dd>
          </div>
        </dl>
      </header>

      {d.status === 'no_match' && (
        <section className={styles.noMatch} aria-labelledby="nomatch">
          <h2 id="nomatch">Why nothing qualified</h2>
          <ul>
            {byOutcome('excluded').length > 0 && <li>{byOutcome('excluded').length} products were excluded by your limits.</li>}
            {byOutcome('limited_evidence').length > 0 && (
              <li>{byOutcome('limited_evidence').length} are linked to your goals only by lab work, null results or a different preparation.</li>
            )}
            {byOutcome('unverified').length > 0 && <li>{byOutcome('unverified').length} could not be verified.</li>}
            <li>{byOutcome('not_relevant').length} have no studied botanical for these goals.</li>
          </ul>
          {alternatives.length > 0 ? (
            <p>
              With the same limits, the catalogue does have eligible products for:{' '}
              {alternatives.map((g) => GOAL_LABELS[g].label.toLowerCase()).join('; ')}.{' '}
              <Link href="/consult/goals">Adjust your goals</Link>
            </p>
          ) : (
            <p>
              Loosening a limit is the only way to get a match from this catalogue. <Link href="/consult/goals">Review your limits</Link>
            </p>
          )}
        </section>
      )}

      {shortlist.length > 0 && (
        <form action="/compare" method="get">
          <ol className={styles.list}>
            {shortlist.map((p) => (
              <ShortlistEntry key={p.productId} p={p} goals={d.input.goals} />
            ))}
          </ol>
          {more.length > 0 && (
            <details className="fold">
              <summary>Also eligible ({more.length})</summary>
              <div className="fold-body">
                <ol className={styles.list} start={shortlist.length + 1}>
                  {more.map((p) => (
                    <ShortlistEntry key={p.productId} p={p} goals={d.input.goals} />
                  ))}
                </ol>
              </div>
            </details>
          )}
          <div className={styles.compareBar}>
            <p className="small">Tick two to four products to compare them side by side.</p>
            <button type="submit" className="btn secondary">
              Compare selected
            </button>
          </div>
        </form>
      )}

      <section className="section" aria-labelledby="aside">
        <h2 id="aside">Set aside, and why</h2>
        {SET_ASIDE.map(({ outcome, intro }) => {
          const items = byOutcome(outcome);
          if (!items.length) return null;
          return (
            <details key={outcome} className="fold">
              <summary>
                <span>
                  {OUTCOME_LABEL[outcome]} ({items.length})
                </span>
              </summary>
              <div className="fold-body">
                <p className="small">{intro}</p>
                <ul className={styles.asideList}>
                  {items.map((p) => {
                    const prod = getProduct(p.productId)!;
                    const reason = firstReason(p);
                    return (
                      <li key={p.productId}>
                        <Link href={`/products/${p.productId}`}>
                          {prod.brand} {prod.name}
                        </Link>
                        {reason && outcome !== 'not_relevant' && <span className="small"> {reason}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          );
        })}
      </section>

      <footer className={styles.provenance}>
        <p className="small">
          Decision {row.id}, made {formatDateTime(row.createdAt)} with rules {d.ruleVersion} and catalogue {d.catalogueVersion}. Inputs{' '}
          {d.inputsHash.slice(0, 12)}. {analysis?.status === 'succeeded' ? `Goals informed by analysis ${analysis.id} (${analysis.providerMode === 'live' ? 'YouCam' : 'fixture'}).` : 'No analysis used.'}{' '}
          The same choices, catalogue and rules always give this same decision. <Link href="/ledger">How the Ledger works</Link>
        </p>
      </footer>
    </div>
  );
}

function ShortlistEntry({ p, goals }: { p: ProductAssessment; goals: string[] }) {
  const prod = getProduct(p.productId)!;
  const lead = getBotanical(prod.botanicals[0]?.botanicalId ?? '');
  const cautions = p.factors.filter((f) => f.effect === 'cautions');
  return (
    <li className={styles.entry}>
      <span className={styles.rank} aria-label={`Rank ${p.rank}`}>
        {p.rank}
      </span>
      <div className={styles.thumb}>{lead && <BotanicalPlate id={lead.id} title="" />}</div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3>
            <Link href={`/products/${p.productId}`}>
              {prod.brand} {prod.name}
            </Link>
          </h3>
          <OutcomeMark outcome={p.outcome} short />
        </div>
        <p className="small">
          {CATEGORY_LABELS[prod.category]}
          {p.tiedWith.length ? `. Tied on every ranking key with ${p.tiedWith.length} other${p.tiedWith.length > 1 ? 's' : ''}; listed alphabetically.` : '.'}
        </p>
        <ul className={styles.goalLines}>
          {p.goals
            .filter((g) => goals.includes(g.goal))
            .map((g) => (
              <li key={g.goal}>
                <span className={styles.goalName}>{GOAL_LABELS[g.goal].short}</span>
                <GradeChip grade={g.grade} />
                <ApplicabilityChip value={g.applicability} />
                <span className="small">
                  via {g.inci}
                  {!g.qualifies && ', does not count towards eligibility'}
                </span>
              </li>
            ))}
        </ul>
        {cautions.length > 0 && (
          <p className={`small ${styles.caution}`}>
            Caution: {cautions.map((f) => (f.ingredient ? `${f.ingredient}` : f.message)).filter((v, i, a) => a.indexOf(v) === i).join('; ')}.
          </p>
        )}
      </div>
      <label className={styles.compare}>
        <input type="checkbox" name="ids" value={p.productId} /> Compare
      </label>
    </li>
  );
}
