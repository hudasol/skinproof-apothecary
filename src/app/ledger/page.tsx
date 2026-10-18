import type { Metadata } from 'next';
import Link from 'next/link';
import { ApplicabilityChip, GradeChip } from '@/components/marks';
import { getCatalogue, getCatalogueVersion } from '@/lib/catalogue';
import type { Applicability } from '@/lib/ledger/types';
import { RULE_VERSION, RULES, SHORTLIST_SIZE } from '@/lib/ledger/rules';
import { GRADE_EXPLAIN, GRADE_ORDERED, STAGES } from '@/lib/view';
import styles from './ledger.module.css';

export const metadata: Metadata = { title: 'The Botanical Evidence Ledger' };

const APPLICABILITY: { value: Applicability; text: string }[] = [
  { value: 'close_match', text: 'Same preparation, same way of use, and the brand states at least the amount that was studied.' },
  { value: 'concentration_unknown', text: 'Same preparation and use, but the brand does not say how much is in it. Most products are here.' },
  { value: 'weaker_match', text: 'Same preparation, but less than was studied, or rinsed off when it was studied left on.' },
  { value: 'different_preparation', text: 'The studies used another part or form of the plant, or an isolated compound. Does not count.' },
];

const SOURCE = 'https://github.com/hudasol/skinproof-apothecary/blob/main/src/lib/ledger/engine.ts';

export default function LedgerPage() {
  const cat = getCatalogue();
  return (
    <div className="wrap page">
      <header className="page-head">
        <h1>The Botanical Evidence Ledger</h1>
        <p>
          The rules SkinProof uses to decide which products you see. They are applied in the same order, to every product, every time.
          Nothing is decided by a language model, a commission or a hidden weight.
        </p>
      </header>

      <section aria-labelledby="separate">
        <h2 id="separate">Three questions, kept apart</h2>
        <div className={styles.three}>
          <div>
            <h3>Is the research any good?</h3>
            <p>
              <strong>Evidence strength</strong> grades the studies of one botanical preparation for one goal: how they were designed,
              where, and whether they isolate the botanical.
            </p>
          </div>
          <div>
            <h3>Is this product what was studied?</h3>
            <p>
              <strong>Formulation match</strong> compares the product’s ingredient with the studied preparation: same part and form, a stated
              amount, used the same way.
            </p>
          </div>
          <div>
            <h3>Should you consider it?</h3>
            <p>
              <strong>Eligibility</strong> applies your limits first, then product information, relevance, and both assessments above. Good
              research on an ingredient never makes a product eligible on its own.
            </p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="stages">
        <h2 id="stages">The six stages</h2>
        <ol className={styles.stageList}>
          {STAGES.map((name, i) => {
            const rules = RULES.filter((r) => r.stage.startsWith(`${i + 1} `));
            return (
              <li key={name} className={styles.stage}>
                <h3>
                  <span className={styles.no}>{i + 1}</span> {name}
                </h3>
                <dl className={styles.rules}>
                  {rules.map((r) => (
                    <div key={r.id} id={r.id} className={styles.rule}>
                      <dt>
                        {r.title} <span className={styles.ruleId}>{r.id}</span>
                      </dt>
                      <dd>
                        <p>{r.rule}</p>
                        <p className="small">{r.why}</p>
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="two-col section">
        <section aria-labelledby="grades">
          <h2 id="grades">Evidence grades</h2>
          <ul className={styles.legend}>
            {GRADE_ORDERED.map((g) => (
              <li key={g}>
                <GradeChip grade={g} />
                <span className="small">{GRADE_EXPLAIN[g]}</span>
              </li>
            ))}
          </ul>
          <p className="small">
            Products qualify on limited, moderate, strong or conflicting human evidence. Conflicting evidence always carries a caution.
          </p>
        </section>
        <section aria-labelledby="match">
          <h2 id="match">Formulation match</h2>
          <ul className={styles.legend}>
            {APPLICABILITY.map((a) => (
              <li key={a.value}>
                <ApplicabilityChip value={a.value} />
                <span className="small">{a.text}</span>
              </li>
            ))}
          </ul>
          <p className="small">An amount is never inferred from where an ingredient sits on the label.</p>
        </section>
      </div>

      <section className="section" aria-labelledby="never">
        <h2 id="never">What the Ledger never does</h2>
        <ul className={styles.never}>
          <li>Let a ranking, preference or partnership override one of your limits.</li>
          <li>Treat missing information as proof of safety, or as proof of danger.</li>
          <li>Turn a skin analysis score into a diagnosis or an absolute verdict.</li>
          <li>Count a study of a whole product as evidence for one of its ingredients, beyond “limited”.</li>
          <li>Show prices or stock it cannot verify.</li>
          <li>Force a recommendation: if nothing qualifies, it says so.</li>
        </ul>
      </section>

      <section className="section" aria-labelledby="versions">
        <h2 id="versions">Versions and reproducibility</h2>
        <p>
          Every decision records the rule version, the catalogue version and a hash of your inputs. The same three always produce the same
          decision; the shortlist shows the first {SHORTLIST_SIZE} eligible products in rank order.
        </p>
        <dl className={styles.versions}>
          <div>
            <dt>Rules</dt>
            <dd>{RULE_VERSION}</dd>
          </div>
          <div>
            <dt>Catalogue</dt>
            <dd>
              {getCatalogueVersion()}: {cat.botanicals.length} botanicals, {cat.studies.length} studies, {cat.products.length} products
            </dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              <a href={SOURCE} rel="noopener noreferrer" target="_blank">
                The engine’s code
              </a>{' '}
              and its tests are public.
            </dd>
          </div>
        </dl>
        <p>
          <Link href="/library">See the evidence in the Botanical library</Link>
        </p>
      </section>
    </div>
  );
}
