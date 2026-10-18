import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ConsultSteps } from '@/components/ConsultSteps';
import { PhotoForm } from '@/components/forms/PhotoForm';
import { completedSteps } from '@/lib/consult-progress';
import { getDb } from '@/lib/db/client';
import { providerState } from '@/lib/providers';
import { currentConsultation, hasSpendAccess } from '@/lib/session';
import styles from '../consult.module.css';

export const metadata: Metadata = { title: 'Your photo' };

export default async function PhotoPage() {
  const db = getDb();
  const c = await currentConsultation(db);
  if (!c?.analysisConsentAt) redirect('/consult');
  const provider = providerState();
  const access = await hasSpendAccess();

  return (
    <div className="wrap page">
      <ConsultSteps current="photo" done={completedSteps(db, c)} />
      <div className="aside-layout">
        <div>
          <header className="page-head">
            <h1>Add a photo of your face</h1>
            <p>One clear, front-facing photo. The better the light, the more the analysis can see.</p>
          </header>
          {provider.mode === 'live' && !provider.ready ? (
            <div className="notice error">
              <strong>Skin analysis is unavailable on this server.</strong>
              <p>
                You can still <Link href="/consult/goals">choose your goals yourself</Link> and get a shortlist.
              </p>
            </div>
          ) : !access ? (
            <div className="notice caution">
              <strong>This hosted demo needs an access code before it calls YouCam.</strong>
              <p>
                Enter it on the <Link href="/system">integration page</Link>, or <Link href="/consult/goals">choose your goals yourself</Link>.
              </p>
            </div>
          ) : (
            <PhotoForm next="analysis" submitLabel="Analyse my skin" />
          )}
          <p className="small" style={{ marginTop: 'var(--space-5)' }}>
            Rather not? <Link href="/consult/goals">Choose your goals without an analysis</Link>.
          </p>
        </div>
        <aside className={styles.side}>
          <h3>For a good analysis</h3>
          <ul className="small">
            <li>Face a window or soft, even light. Avoid harsh shadows and backlight.</li>
            <li>Look straight at the camera, mouth closed, eyes open.</li>
            <li>Take off glasses and brush hair off your forehead.</li>
            <li>Bare skin gives the most accurate result: makeup hides what the analysis looks for.</li>
            <li>Your face should fill most of the frame.</li>
          </ul>
          <p className="small muted">This guidance comes from YouCam’s own photo requirements.</p>
        </aside>
      </div>
    </div>
  );
}
