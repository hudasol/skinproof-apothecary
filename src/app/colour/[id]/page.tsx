import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IngredientLabel } from '@/components/IngredientLabel';
import { PhotoForm } from '@/components/forms/PhotoForm';
import { PreviewConsentForm } from '@/components/forms/PreviewConsentForm';
import { TryOnPanel } from '@/components/forms/TryOnPanel';
import { getProduct } from '@/lib/catalogue';
import { getDb } from '@/lib/db/client';
import { EMPTY_CONSTRAINTS } from '@/lib/domain/profile';
import { checkColourShade } from '@/lib/ledger/engine';
import { providerState } from '@/lib/providers';
import { currentPhoto } from '@/lib/services/consultations';
import { previewsFor } from '@/lib/services/previews';
import { currentConsultation, hasSpendAccess } from '@/lib/session';
import { formatDate } from '@/lib/view';
import styles from '../colour.module.css';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = getProduct((await params).id);
  return { title: p ? `${p.brand} ${p.name}, try-on` : 'Try-on' };
}

export default async function StudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ shade?: string }> }) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product || product.shelf !== 'colour') notFound();
  const requested = (await searchParams).shade;
  const shade = product.shades.find((s) => s.id === requested) ?? product.shades.find((s) => s.render) ?? product.shades[0]!;
  const db = getDb();
  const c = await currentConsultation(db);
  const constraints = c?.profile?.constraints ?? EMPTY_CONSTRAINTS;
  const checks = Object.fromEntries(product.shades.map((s) => [s.id, checkColourShade(product, s.id, constraints)]));
  const check = checks[shade.id]!;
  const photo = c ? currentPhoto(db, c.id) : undefined;
  const existing = c && photo ? previewsFor(db, c.id).find((p) => p.productId === product.id && p.shadeId === shade.id && p.status === 'succeeded' && p.createdAt >= photo.createdAt) : undefined;
  const provider = providerState();
  const access = await hasSpendAccess();
  const returnTo = `/colour/${product.id}?shade=${shade.id}`;
  const label = shade.ingredientsVerbatim ?? product.ingredientsVerbatim;

  let panel: React.ReactNode;
  if (!shade.render) {
    panel = <div className="notice">This shade cannot be previewed: {product.brand} publishes no swatch image to measure a colour from, and SkinProof does not guess one.</div>;
  } else if (check.outcome === 'excluded') {
    panel = (
      <div className="notice error">
        <strong>Excluded by your limits</strong>
        <ul className="small">
          {check.factors.map((f, i) => (
            <li key={i}>
              {f.ingredient}: {f.message}
            </li>
          ))}
        </ul>
        <p className="small">Excluded shades are not offered for try-on. <Link href="/consult/goals">Review your limits</Link></p>
      </div>
    );
  } else if (check.outcome === 'unverified') {
    panel = <div className="notice">This shade’s ingredients could not be verified, so it is not offered for try-on.</div>;
  } else if (provider.mode === 'live' && !provider.ready) {
    panel = <div className="notice error">Try-on is unavailable on this server.</div>;
  } else if (!c?.previewConsentAt) {
    panel = <PreviewConsentForm returnTo={returnTo} />;
  } else if (!access) {
    panel = (
      <div className="notice caution">
        This hosted demo needs an access code before it calls YouCam. Enter it on the <Link href="/system">integration page</Link>.
      </div>
    );
  } else if (!photo) {
    panel = (
      <>
        <p>Add a front-facing photo to try shades on. Photos are deleted after a day.</p>
        <PhotoForm next="colour" submitLabel="Use this photo" returnTo={returnTo} />
      </>
    );
  } else {
    panel = (
      <TryOnPanel
        key={shade.id}
        productId={product.id}
        shadeId={shade.id}
        shadeName={shade.name}
        existing={
          existing
            ? {
                id: existing.id,
                status: existing.status,
                providerMode: existing.providerMode,
                inputArtifactId: existing.inputArtifactId,
                outputArtifactId: existing.outputArtifactId,
                failure: existing.failure,
              }
            : null
        }
      />
    );
  }

  return (
    <div className="wrap page">
      <p className="small">
        <Link href="/colour">Lip colour</Link>
      </p>
      <header className="page-head">
        <h1>
          {product.brand} {product.name}
        </h1>
        <p>{product.description}</p>
      </header>
      <div className={styles.studio}>
        <div>
          <h2 style={{ fontSize: 'var(--step-2)' }}>Shades</h2>
          <ul className={styles.swatches}>
            {product.shades.map((s) => {
              const blocked = checks[s.id]!.outcome !== 'passes' || !s.render;
              return (
                <li key={s.id}>
                  <Link href={`/colour/${product.id}?shade=${s.id}`} className={`${styles.swatch} ${blocked ? styles.blocked : ''}`} aria-current={s.id === shade.id ? 'true' : undefined}>
                    <span className={styles.chip} style={{ background: s.render?.hex ?? 'transparent' }} aria-hidden="true" />
                    <span>
                      <strong>{s.name}</strong>
                      <span className="small">{s.colourWords ?? 'No colour description'}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className={styles.shadeInfo} style={{ marginTop: 'var(--space-4)' }}>
            <p>
              <strong>{shade.name}</strong>
              {shade.colourWords && `, described as “${shade.colourWords}” by the ${shade.colourWordsSource === 'retailer' ? 'retailer' : 'brand'}`}
            </p>
            {shade.render ? (
              <p>
                Rendering colour {shade.render.hex}, measured {formatDate(shade.render.measuredOn)}. {shade.render.detail}
              </p>
            ) : (
              <p>No rendering colour: the brand publishes no swatch.</p>
            )}
            {shade.swatch && (
              <p>
                <a href={shade.swatch.pageUrl} rel="noopener noreferrer" target="_blank">
                  See the brand’s own swatch
                </a>
              </p>
            )}
            {check.factors
              .filter((f) => f.effect === 'cautions')
              .map((f, i) => (
                <p key={i} className="small" style={{ color: 'var(--amber-700)' }}>
                  {f.message}
                </p>
              ))}
            {product.retailers.map((r) => (
              <a key={r.url} href={r.url} rel="noopener noreferrer" target="_blank" className="btn secondary small" style={{ marginTop: 'var(--space-2)' }}>
                View at {r.label}
              </a>
            ))}
          </div>
        </div>
        <section aria-labelledby="tryon">
          <h2 id="tryon" style={{ fontSize: 'var(--step-2)' }}>
            Try {shade.name} on
          </h2>
          {panel}
          {label && (
            <div className="section">
              <IngredientLabel product={product} verbatim={label} title={`Ingredients as published${shade.ingredientsVerbatim ? ` (${shade.name})` : ''}`} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
