import type { Metadata } from 'next';
import Link from 'next/link';
import { ConsultSteps } from '@/components/ConsultSteps';
import { ConsentForm } from '@/components/forms/ConsentForm';
import { completedSteps } from '@/lib/consult-progress';
import { getDb } from '@/lib/db/client';
import { getEnv } from '@/lib/env';
import { currentConsultation } from '@/lib/session';
import { formatDateTime } from '@/lib/view';
import styles from './consult.module.css';

export const metadata: Metadata = { title: 'Consultation' };

export default async function ConsultPage() {
  const db = getDb();
  const c = await currentConsultation(db);
  const env = getEnv();
  const hours = Math.round(env.imageRetentionMs / 3_600_000);
  const days = Math.round(env.consultationRetentionMs / 86_400_000);

  return (
    <div className="wrap page">
      <ConsultSteps current="consent" done={completedSteps(db, c)} />
      <div className="aside-layout">
        <div>
          <header className="page-head">
            <h1>Before we look at your skin</h1>
            <p>Here is exactly what happens to your photo and your answers. Read it once; it is short.</p>
          </header>
          <ul className={styles.facts}>
            <li>
              <h3>Your photo goes to YouCam</h3>
              <p>
                SkinProof strips the photo’s hidden data (location, camera, time) and sends the image to Perfect Corp.’s YouCam API, which
                scores visible concerns such as redness, moisture and texture. YouCam’s documentation says it removes uploaded files and
                results after 30 days.
              </p>
            </li>
            <li>
              <h3>We keep it for {hours} hours</h3>
              <p>
                SkinProof stores your photo and the analysis images for {hours} hours, then deletes them automatically. Your scores and
                choices are kept for {days} days so your shortlist still works, then deleted. You can delete everything sooner on the{' '}
                <Link href="/privacy">Your data</Link> page.
              </p>
            </li>
            <li>
              <h3>No account, no profile</h3>
              <p>
                A random identifier in a cookie links your visit to your consultation. We do not ask for your name or email, and nothing is
                sold or shared.
              </p>
            </li>
            <li>
              <h3>Cosmetic, not medical</h3>
              <p>
                The analysis estimates how your skin looks in one photo. It does not diagnose anything. If something worries you, see a
                clinician.
              </p>
            </li>
          </ul>
          <ConsentForm analysisGiven={!!c?.analysisConsentAt} previewGiven={!!c?.previewConsentAt} />
        </div>
        <aside className={styles.side}>
          {c?.analysisConsentAt && (
            <p className="notice">
              You agreed to analysis on {formatDateTime(c.analysisConsentAt)}. <Link href="/consult/photo">Continue to your photo</Link>
            </p>
          )}
          <h3>Only use your own photo</h3>
          <p className="small">Upload a photo of yourself, or of someone who has agreed to it. Do not upload photos of children.</p>
        </aside>
      </div>
    </div>
  );
}
