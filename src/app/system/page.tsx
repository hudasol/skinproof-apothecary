import type { Metadata } from 'next';
import Link from 'next/link';
import { AccessForm } from '@/components/forms/AccessForm';
import { getCatalogueVersion } from '@/lib/catalogue';
import { getDb } from '@/lib/db/client';
import { getEnv } from '@/lib/env';
import { MAKEUP_PREVIEW_UNITS, REQUESTED_CONCERNS, SKIN_ANALYSIS_UNITS } from '@/lib/domain/skin';
import { RULE_VERSION } from '@/lib/ledger/rules';
import { providerState } from '@/lib/providers';
import { unitsUsedToday } from '@/lib/services/budget';
import { hasSpendAccess } from '@/lib/session';

export const metadata: Metadata = { title: 'Integration status' };

/**
 * Plain statement of how SkinProof talks to YouCam and what has been
 * verified. The verification table mirrors docs/API-VERIFICATION.md.
 */
const VERIFIED: { check: string; status: string }[] = [
  { check: 'Skin Analysis: upload, 12 SD concerns as JSON, polling, scores, skin type, masks', status: 'Verified live on 18 October 2026: 14 units, responses matched the documented shapes, masks align with the photo' },
  { check: 'Makeup try-on: lip_color with skin smoothing at 0', status: 'Verified live on 18 October 2026: 1 unit; 1.35% of pixels changed, all over the mouth' },
  { check: 'The full journey in the app in live mode', status: 'Verified live on 18 October 2026: one analysis and one try-on' },
  { check: 'Scope', status: 'One portrait (YouCam’s documentation sample) and one shade: the integration works; behaviour across faces is not measured' },
  { check: 'Both adapters against the documented request and response shapes', status: 'Contract tests pass (no network)' },
];

export default async function SystemPage() {
  const env = getEnv();
  const provider = providerState();
  const access = await hasSpendAccess();
  return (
    <div className="wrap page">
      <header className="page-head">
        <h1>Integration status</h1>
        <p>How this copy of SkinProof is configured, which YouCam APIs it uses, and what has been checked against the real service.</p>
      </header>
      <table className="register">
        <tbody>
          <tr>
            <th scope="row">Mode</th>
            <td>
              {provider.mode === 'fixture'
                ? 'Fixture: skin analysis and try-on are offline placeholders. Nothing is sent to YouCam and every result is labelled.'
                : provider.ready
                  ? 'Live: skin analysis and try-on call the YouCam API.'
                  : `Live, but not ready: ${provider.problem}`}
            </td>
          </tr>
          <tr>
            <th scope="row">Skin analysis</th>
            <td>
              YouCam AI Skin Analysis, <code>/s2s/v2.0/task/skin-analysis</code>, {REQUESTED_CONCERNS.length} SD concerns as JSON, about{' '}
              {SKIN_ANALYSIS_UNITS} units per analysis.
            </td>
          </tr>
          <tr>
            <th scope="row">Lip try-on</th>
            <td>
              YouCam AI Makeup Virtual Try-On, <code>/s2s/v2.0/task/makeup-vto</code>, <code>lip_color</code> with skin smoothing at 0,{' '}
              {MAKEUP_PREVIEW_UNITS} unit per render.
            </td>
          </tr>
          {provider.mode === 'live' && (
            <tr>
              <th scope="row">Units today</th>
              <td>
                {unitsUsedToday(getDb())} of a {env.liveDailyUnitBudget}-unit daily budget (estimated from the documented unit table).
              </td>
            </tr>
          )}
          <tr>
            <th scope="row">Ledger</th>
            <td>
              Rules {RULE_VERSION}, catalogue {getCatalogueVersion()}. <Link href="/ledger">Read the rules</Link>
            </td>
          </tr>
        </tbody>
      </table>

      <section className="section" aria-labelledby="verified">
        <h2 id="verified">What has been verified</h2>
        <table className="register">
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {VERIFIED.map((v) => (
              <tr key={v.check}>
                <td>{v.check}</td>
                <td>{v.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small">The full record, including discrepancies found in the official documentation, is in the repository’s API verification file.</p>
      </section>

      {provider.mode === 'live' && env.accessCode && (
        <section className="section" aria-labelledby="access">
          <h2 id="access">Access code</h2>
          {access ? <p>This browser can use live analysis and try-on.</p> : <AccessForm />}
        </section>
      )}
    </div>
  );
}
