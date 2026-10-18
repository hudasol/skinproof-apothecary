import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DecisionTrail } from '@/components/DecisionTrail';
import { IngredientLabel } from '@/components/IngredientLabel';
import { ApplicabilityChip, GradeChip, OutcomeMark } from '@/components/marks';
import { getBotanical, getCatalogue, getProduct, getStudy } from '@/lib/catalogue';
import { preparationLabel } from '@/lib/catalogue/facts';
import { CATEGORY_LABELS } from '@/lib/domain/profile';
import { GOAL_LABELS, GOALS } from '@/lib/domain/skin';
import { assessGoalLinks, assessGoals } from '@/lib/ledger/engine';
import { assessmentFor, personalContext } from '@/lib/personal';
import { GRADE_EXPLAIN, OUTCOME_LABEL, citationShort, formatDate } from '@/lib/view';
import styles from '../products.module.css';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = getProduct((await params).id);
  return { title: p ? `${p.brand} ${p.name}` : 'Product' };
}

const VERIFICATION_TEXT = {
  verified: 'Full ingredient list traced to the source page.',
  partial: 'Ingredient list traced, with an unresolved issue.',
  unverified: 'No full ingredient list could be traced.',
};

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();
  if (product.shelf === 'colour') {
    return (
      <div className="wrap page">
        <p>
          This is a lip colour product. <Link href={`/colour/${product.id}`}>Open it in the lip colour studio</Link>.
        </p>
      </div>
    );
  }
  const cat = getCatalogue();
  const { consultation, decision } = await personalContext();
  const mine = assessmentFor(decision, product.id);
  const studiesByBotanical = new Map<string, typeof cat.studies>();
  for (const s of cat.studies) studiesByBotanical.set(s.botanicalId, [...(studiesByBotanical.get(s.botanicalId) ?? []), s]);
  // Without a consultation, show the evidence for every goal; with one, the person's goals come first.
  const goalOrder = mine ? [...decision!.decision.input.goals, ...GOALS.filter((g) => !decision!.decision.input.goals.includes(g))] : [...GOALS];
  const evidence = assessGoalLinks(product, goalOrder, studiesByBotanical);
  const counted = new Set(assessGoals(product, goalOrder, studiesByBotanical).map((g) => `${g.goal}|${g.inci}`));
  const unknowns = [
    ...product.botanicals.filter((b) => !b.concentration).map((b) => `How much ${b.inci} the product contains: the brand does not say.`),
    ...(product.sourceConflicts ? [product.sourceConflicts] : []),
    ...(product.verificationNote ? [product.verificationNote] : []),
    'Current price and stock: SkinProof shows no prices because none could be verified as current.',
  ];

  return (
    <div className="wrap page">
      <p className="small">
        <Link href="/products">Apothecary</Link>
      </p>
      <header className={styles.dossierHead}>
        <div>
          <p className={styles.brand}>{product.brand}</p>
          <h1>{product.name}</h1>
          <p className="lede">{product.description}</p>
          <p className="small">
            {CATEGORY_LABELS[product.category]}, {product.use === 'rinse_off' ? 'rinsed off' : 'left on the skin'}.{' '}
            {VERIFICATION_TEXT[product.verification]} Checked {formatDate(product.source.checkedOn)} on the{' '}
            <a href={product.source.url} rel="noopener noreferrer" target="_blank">
              {product.source.type === 'brand' ? 'brand’s page' : 'retailer’s page'}
            </a>
            .
          </p>
        </div>
        <aside className={styles.verdict} aria-label="Verdict">
          {mine ? (
            <>
              <p className="small">For your choices</p>
              <OutcomeMark outcome={mine.outcome} />
              {mine.rank && (
                <p className={styles.rank}>
                  Ranked {mine.rank}
                  {mine.tiedWith.length ? `, tied with ${mine.tiedWith.length}` : ''}
                </p>
              )}
              <p className="small">
                <Link href="/shortlist">Back to your shortlist</Link>
              </p>
            </>
          ) : (
            <>
              <p className="small">
                {consultation?.profile ? 'Your choices changed since the last decision.' : 'No consultation yet.'} The verdict for you
                appears once the Ledger has run on your goals and exclusions.
              </p>
              <Link href={consultation?.profile ? '/shortlist' : '/consult'} className="btn small">
                {consultation?.profile ? 'Update my shortlist' : 'Start a consultation'}
              </Link>
            </>
          )}
          {product.retailers.length > 0 && (
            <div className={styles.buy}>
              {product.retailers.map((r) => (
                <a key={r.url} href={r.url} rel="noopener noreferrer" target="_blank" className="btn secondary small">
                  View at {r.label}
                </a>
              ))}
            </div>
          )}
        </aside>
      </header>

      {mine && (
        <section className="section" aria-labelledby="why">
          <h2 id="why">Why it is {mine.outcome === 'eligible' || mine.outcome === 'caution' ? 'on' : 'not on'} your shortlist</h2>
          <p className="small">{OUTCOME_LABEL[mine.outcome]}. Each line names the rule that produced it.</p>
          <DecisionTrail factors={mine.factors} />
        </section>
      )}

      <section className="section" aria-labelledby="evidence">
        <h2 id="evidence">Evidence for each goal</h2>
        <p>
          Evidence strength is about the research on a preparation. Formulation match is about whether this product contains that same
          preparation, in a known amount, used the same way. They are judged separately.
        </p>
        {evidence.length === 0 ? (
          <p className="notice">None of this product’s ingredients is a catalogue botanical with studies, so the Ledger has nothing to weigh.</p>
        ) : (
          <div className="table-scroll">
            <table className="register">
              <thead>
                <tr>
                  <th scope="col">Goal</th>
                  <th scope="col">Ingredient on the label</th>
                  <th scope="col">Evidence strength</th>
                  <th scope="col">Formulation match</th>
                  <th scope="col">Studies</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((g, row) => {
                  const firstOfGoal = row === 0 || evidence[row - 1]!.goal !== g.goal;
                  const isCounted = counted.has(`${g.goal}|${g.inci}`);
                  const b = getBotanical(g.botanicalId)!;
                  const ing = product.botanicals.find((x) => x.inci === g.inci)!;
                  return (
                    <tr key={`${g.goal}-${g.inci}`} className={mine && decision!.decision.input.goals.includes(g.goal) ? styles.yourGoal : undefined}>
                      <td>
                        {firstOfGoal && (
                          <>
                            <strong>{GOAL_LABELS[g.goal].label}</strong>
                            {mine && decision!.decision.input.goals.includes(g.goal) && <span className="small"> (your goal)</span>}
                          </>
                        )}
                      </td>
                      <td>
                        {g.inci}
                        <span className="small" style={{ display: 'block' }}>
                          <Link href={`/library/${b.id}`}>{b.commonName}</Link>, {preparationLabel(ing.preparation)}
                        </span>
                        {ing.note && <span className="small" style={{ display: 'block' }}>{ing.note}</span>}
                      </td>
                      <td>
                        <GradeChip grade={g.grade} />
                        <span className="small" style={{ display: 'block' }}>
                          {GRADE_EXPLAIN[g.grade]}
                        </span>
                      </td>
                      <td>
                        <ApplicabilityChip value={g.applicability} />
                        {isCounted && evidence.filter((e) => e.goal === g.goal).length > 1 && <span className="small"> Counted by the Ledger</span>}
                        <span className="small" style={{ display: 'block' }}>
                          {g.applicabilityReasons.join(' ')}
                        </span>
                      </td>
                      <td className="small">
                        {[...g.gradeBasis, ...g.otherPreparationStudies].map((sid) => {
                          const s = getStudy(sid)!;
                          return (
                            <span key={sid} style={{ display: 'block' }}>
                              <Link href={`/library/${s.botanicalId}#${s.id}`}>{citationShort(s)}</Link>
                              {g.otherPreparationStudies.includes(sid) ? ' (other preparation)' : ''}
                            </span>
                          );
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="two-col section">
        <div>
          {product.ingredientsVerbatim ? (
            <IngredientLabel product={product} verbatim={product.ingredientsVerbatim} />
          ) : (
            <div className="notice caution">
              <strong>No ingredient list to show</strong>
              <p>{product.verificationNote}</p>
            </div>
          )}
        </div>
        <section aria-labelledby="unknowns">
          <h3 id="unknowns">What is not known</h3>
          <ul className={styles.unknowns}>
            {unknowns.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
          <p className="small">
            Unknown values stay unknown. SkinProof never estimates a concentration from where an ingredient sits in the list.
          </p>
        </section>
      </div>

      <p className="small section">
        Catalogue {decision?.decision.catalogueVersion ?? 'current'}
        {decision ? `, rules ${decision.decision.ruleVersion}, decision ${decision.id}` : ''}.
      </p>
    </div>
  );
}
