import type { Metadata } from 'next';
import Link from 'next/link';
import { ApplicabilityChip, GradeChip, OutcomeMark } from '@/components/marks';
import { getCatalogue, getProduct } from '@/lib/catalogue';
import type { Product } from '@/lib/catalogue/schema';
import { CATEGORY_LABELS } from '@/lib/domain/profile';
import { GOAL_LABELS, GOALS, type Goal } from '@/lib/domain/skin';
import { assessGoals, readLabel } from '@/lib/ledger/engine';
import { assessmentFor, personalContext } from '@/lib/personal';
import styles from './compare.module.css';

export const metadata: Metadata = { title: 'Compare' };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const raw = (await searchParams).ids;
  const ids = [...new Set((Array.isArray(raw) ? raw : raw ? raw.split(',') : []).map((s) => s.trim()).filter(Boolean))];
  const products = ids.map((id) => getProduct(id)).filter((p): p is Product => !!p && p.shelf === 'skincare').slice(0, 4);

  if (products.length < 2) {
    return (
      <div className="wrap page">
        <header className="page-head">
          <h1>Compare products</h1>
          <p>Choose two to four products from your shortlist to see them side by side.</p>
        </header>
        <div className="actions">
          <Link href="/shortlist" className="btn">
            Go to your shortlist
          </Link>
          <Link href="/products" className="btn secondary">
            Browse the apothecary
          </Link>
        </div>
      </div>
    );
  }

  const cat = getCatalogue();
  const studiesByBotanical = new Map<string, typeof cat.studies>();
  for (const s of cat.studies) studiesByBotanical.set(s.botanicalId, [...(studiesByBotanical.get(s.botanicalId) ?? []), s]);
  const { decision } = await personalContext();
  const goals: Goal[] = decision
    ? decision.decision.input.goals
    : GOALS.filter((g) => products.some((p) => assessGoals(p, [g], studiesByBotanical).length > 0));
  const label = (p: Product) => (p.ingredientsVerbatim ? readLabel(p.ingredientsVerbatim, p.actives.map((a) => a.name)) : null);

  return (
    <div className="wrap page">
      <p className="small">
        <Link href="/shortlist">Your shortlist</Link>
      </p>
      <header className="page-head">
        <h1>Side by side</h1>
        <p>
          The same facts for each product, in the same order. {decision ? 'Rows marked with your goals use your decision.' : 'Run a consultation to see verdicts for your choices.'}
        </p>
      </header>
      <div className="table-scroll">
        <table className={`register ${styles.table}`}>
          <thead>
            <tr>
              <th scope="col" className={styles.rowHead}>
                <span className="visually-hidden">Fact</span>
              </th>
              {products.map((p) => (
                <th key={p.id} scope="col">
                  <span className={styles.brand}>{p.brand}</span>
                  <Link href={`/products/${p.id}`} className={styles.name}>
                    {p.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {decision && (
              <tr>
                <th scope="row">Verdict for you</th>
                {products.map((p) => {
                  const a = assessmentFor(decision, p.id);
                  return <td key={p.id}>{a ? <OutcomeMark outcome={a.outcome} /> : '—'}{a?.rank ? <span className="small"> Rank {a.rank}</span> : null}</td>;
                })}
              </tr>
            )}
            <tr>
              <th scope="row">Type and use</th>
              {products.map((p) => (
                <td key={p.id}>
                  {CATEGORY_LABELS[p.category]}, {p.use === 'rinse_off' ? 'rinsed off' : 'left on'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Ingredient list</th>
              {products.map((p) => (
                <td key={p.id}>{p.verification === 'verified' ? 'Verified' : p.verification === 'partial' ? 'Partly verified' : 'Not verified'}</td>
              ))}
            </tr>
            {goals.map((g) => (
              <tr key={g}>
                <th scope="row">
                  {GOAL_LABELS[g].label}
                  {decision && <span className="small"> (your goal)</span>}
                </th>
                {products.map((p) => {
                  const a = assessGoals(p, [g], studiesByBotanical)[0];
                  return (
                    <td key={p.id}>
                      {a ? (
                        <div className={styles.cell}>
                          <GradeChip grade={a.grade} />
                          <ApplicabilityChip value={a.applicability} />
                          <span className="small">via {a.inci}</span>
                        </div>
                      ) : (
                        <span className="muted">No studied botanical</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row">Amount of the botanical stated</th>
              {products.map((p) => {
                const stated = [...p.botanicals.filter((b) => b.concentration).map((b) => b.concentration!.wording), ...p.actives.map((a) => `${a.name} ${a.percent}%`)];
                return <td key={p.id}>{stated.length ? [...new Set(stated)].join('; ') : 'Not stated'}</td>;
              })}
            </tr>
            <tr>
              <th scope="row">Fragrance or scent</th>
              {products.map((p) => {
                const l = label(p);
                return <td key={p.id}>{!l ? 'Unknown' : l.fragrance.length ? l.fragrance.map((m) => m.ingredient).join(', ') : 'None listed'}</td>;
              })}
            </tr>
            <tr>
              <th scope="row">Essential oils</th>
              {products.map((p) => {
                const l = label(p);
                return <td key={p.id}>{!l ? 'Unknown' : l.essentialOils.length ? l.essentialOils.map((m) => m.ingredient).join(', ') : 'None listed'}</td>;
              })}
            </tr>
            <tr>
              <th scope="row">Labelled fragrance allergens</th>
              {products.map((p) => {
                const l = label(p);
                return <td key={p.id}>{!l ? 'Unknown' : l.allergens.length ? l.allergens.map((m) => m.ingredient).join(', ') : 'None listed'}</td>;
              })}
            </tr>
            <tr>
              <th scope="row">Daisy-family plants</th>
              {products.map((p) => {
                const l = label(p);
                return <td key={p.id}>{!l ? 'Unknown' : l.asteraceae.length ? l.asteraceae.map((m) => m.ingredient).join(', ') : 'None listed'}</td>;
              })}
            </tr>
            <tr>
              <th scope="row">Open questions</th>
              {products.map((p) => (
                <td key={p.id} className="small">
                  {[p.sourceConflicts, p.verificationNote].filter(Boolean).join(' ') || 'None recorded'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Where to look</th>
              {products.map((p) => (
                <td key={p.id}>
                  {p.retailers.map((r) => (
                    <a key={r.url} href={r.url} rel="noopener noreferrer" target="_blank" className={styles.buy}>
                      View at {r.label}
                    </a>
                  ))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small section">Prices are not shown: SkinProof could not verify any as current. Check the retailer before you buy.</p>
    </div>
  );
}
