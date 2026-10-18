import type { Metadata } from 'next';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { deleteMyDataAction } from '@/app/actions';
import { SubmitButton } from '@/components/forms/bits';
import { getDb } from '@/lib/db/client';
import { analyses, artifacts, decisions, previews } from '@/lib/db/schema';
import { getEnv } from '@/lib/env';
import { currentConsultation } from '@/lib/session';
import { formatDateTime } from '@/lib/view';

export const metadata: Metadata = { title: 'Your data' };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const db = getDb();
  const c = await currentConsultation(db);
  const env = getEnv();
  const hours = Math.round(env.imageRetentionMs / 3_600_000);
  const days = Math.round(env.consultationRetentionMs / 86_400_000);
  const counts = c
    ? {
        images: db.select().from(artifacts).where(eq(artifacts.consultationId, c.id)).all().length,
        analyses: db.select().from(analyses).where(eq(analyses.consultationId, c.id)).all().length,
        decisions: db.select().from(decisions).where(eq(decisions.consultationId, c.id)).all().length,
        previews: db.select().from(previews).where(eq(previews.consultationId, c.id)).all().length,
      }
    : null;

  return (
    <div className="wrap page">
      <header className="page-head">
        <h1>Your data</h1>
        <p>What SkinProof keeps about you, for how long, and how to delete it now.</p>
      </header>
      {deleted && (
        <div className="notice" role="status">
          <strong>Deleted.</strong>
          <p>Your consultation, photo, analysis, decisions and try-on images have been removed from SkinProof.</p>
        </div>
      )}
      <div className="aside-layout">
        <div>
          <h2>What is stored</h2>
          <table className="register">
            <tbody>
              <tr>
                <th scope="row">Your photo, and images made from it</th>
                <td>
                  Deleted {hours} hours after upload, or straight away when you upload another photo. Location, camera and time data are removed
                  before anything is stored or sent.
                </td>
              </tr>
              <tr>
                <th scope="row">Analysis scores and skin type</th>
                <td>Kept {days} days so your shortlist keeps working, then deleted.</td>
              </tr>
              <tr>
                <th scope="row">Your goals, limits and decisions</th>
                <td>Kept {days} days, then deleted. Decisions record which rules and catalogue version produced them.</td>
              </tr>
              <tr>
                <th scope="row">YouCam’s raw responses</th>
                <td>Never stored. SkinProof keeps only the scores and images it uses.</td>
              </tr>
              <tr>
                <th scope="row">Your identity</th>
                <td>Not collected. A random id in a cookie links your visits; there are no accounts, emails or tracking scripts.</td>
              </tr>
            </tbody>
          </table>
          <h2 className="section">Who else sees your photo</h2>
          <p>
            When you analyse your skin or try on a shade, the photo is sent to Perfect Corp.’s YouCam API. YouCam’s documentation says uploaded
            files and results are removed after 30 days, and that result links expire after two hours. SkinProof cannot delete files on
            YouCam’s side; their terms of service apply to that processing.
          </p>
          <p className="small">
            SkinProof does not claim compliance with any particular privacy law. This page describes what the software does.
          </p>
        </div>
        <aside>
          <h2 style={{ fontSize: 'var(--step-2)' }}>Delete everything now</h2>
          {c && counts ? (
            <>
              <p className="small">
                Your consultation started {formatDateTime(c.createdAt)}. It holds {counts.images} image{counts.images === 1 ? '' : 's'},{' '}
                {counts.analyses} analysis{counts.analyses === 1 ? '' : 'es'}, {counts.decisions} decision{counts.decisions === 1 ? '' : 's'} and{' '}
                {counts.previews} try-on{counts.previews === 1 ? '' : 's'}.
              </p>
              <form action={deleteMyDataAction}>
                <SubmitButton className="btn danger" pending="Deleting…">
                  Delete my consultation
                </SubmitButton>
              </form>
              <p className="small">This cannot be undone. You can start a new consultation at any time.</p>
            </>
          ) : (
            <p className="small">
              Nothing is stored for this browser. <Link href="/consult">Start a consultation</Link>
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
