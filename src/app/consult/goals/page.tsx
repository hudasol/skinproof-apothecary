import type { Metadata } from 'next';
import { ConsultSteps } from '@/components/ConsultSteps';
import { ProfileForm } from '@/components/forms/ProfileForm';
import { getCatalogue } from '@/lib/catalogue';
import { completedSteps } from '@/lib/consult-progress';
import { getDb } from '@/lib/db/client';
import { PRODUCT_CATEGORIES } from '@/lib/domain/profile';
import { CONCERN_LABELS, suggestFocus } from '@/lib/domain/skin';
import { latestAnalysis } from '@/lib/services/analyses';
import { currentConsultation } from '@/lib/session';
import styles from '../consult.module.css';

export const metadata: Metadata = { title: 'Your goals' };

export default async function GoalsPage() {
  const db = getDb();
  const c = await currentConsultation(db);
  const a = c ? latestAnalysis(db, c.id) : undefined;
  const suggestions =
    a?.status === 'succeeded' && a.result
      ? suggestFocus(a.result).map((f) => ({
          goal: f.goal,
          reason: `${CONCERN_LABELS[f.concern].label.toLowerCase()} scored ${Math.round(f.rawScore)}${a.providerMode === 'fixture' ? ' (fixture)' : ''}`,
        }))
      : [];
  const inCatalogue = PRODUCT_CATEGORIES.filter((cat) => getCatalogue().products.some((p) => p.shelf === 'skincare' && p.category === cat));

  return (
    <div className="wrap page">
      <ConsultSteps current="goals" done={completedSteps(db, c)} />
      <div className="aside-layout">
        <div>
          <header className="page-head">
            <h1>Your goals and limits</h1>
            <p>Tell SkinProof what you want, and what you will not use. The Ledger checks every product against both.</p>
          </header>
          <ProfileForm profile={c?.profile ?? null} suggestions={suggestions} categories={inCatalogue} />
        </div>
        <aside className={styles.side}>
          <h3>Goals, not diagnoses</h3>
          <p className="small">
            These are cosmetic goals about how skin looks. SkinProof does not treat conditions such as acne, rosacea or eczema; for those,
            a clinician is the right person to see.
          </p>
        </aside>
      </div>
    </div>
  );
}
