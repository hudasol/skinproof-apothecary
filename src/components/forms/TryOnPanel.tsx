'use client';

import { useActionState, useEffect, useState } from 'react';
import { startPreviewAction } from '@/app/actions';
import { initialState } from '@/app/action-state';
import { CompareSlider } from '../CompareSlider';
import { FormMessage, SubmitButton } from './bits';

type PreviewView = {
  id: string;
  status: string;
  providerMode: 'live' | 'fixture';
  inputArtifactId: string | null;
  outputArtifactId: string | null;
  failure: { message: string; guidance: string | null; retryable: boolean } | null;
};

/**
 * Starts a try-on for one shade and follows it to the result. A finished
 * preview of the same shade on the current photo is shown without spending again.
 */
export function TryOnPanel({ productId, shadeId, shadeName, existing }: { productId: string; shadeId: string; shadeName: string; existing: PreviewView | null }) {
  const [state, action] = useActionState(startPreviewAction, initialState);
  const [view, setView] = useState<PreviewView | null>(existing);
  const id = state.data?.previewId ?? existing?.id ?? null;

  useEffect(() => {
    if (!id) return;
    let stop = false;
    async function tick() {
      try {
        const res = await fetch(`/api/previews/${id}`, { cache: 'no-store' });
        if (res.ok) {
          const body = (await res.json()) as PreviewView;
          if (stop) return;
          setView(body);
          if (['succeeded', 'failed', 'interrupted'].includes(body.status)) return;
        }
      } catch {
        // Retried on the next tick.
      }
      if (!stop) setTimeout(tick, 1200);
    }
    tick();
    return () => {
      stop = true;
    };
  }, [id]);

  const running = view && !['succeeded', 'failed', 'interrupted'].includes(view.status);
  return (
    <div>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="shadeId" value={shadeId} />
        {!running && view?.status !== 'succeeded' && (
          <SubmitButton pending="Starting try-on…">Try {shadeName} on my photo</SubmitButton>
        )}
      </form>
      {running && (
        <p className="notice" role="status" aria-live="polite">
          {view.providerMode === 'live' ? 'YouCam is rendering the shade on your photo.' : 'The fixture is drawing a placeholder tint.'} This takes a few
          seconds.
        </p>
      )}
      {view && (view.status === 'failed' || view.status === 'interrupted') && view.failure && (
        <div className="notice error" role="alert">
          <strong>{view.failure.message}</strong>
          {view.failure.guidance && <p>{view.failure.guidance}</p>}
          <p className="small">Nothing was charged for this attempt.</p>
        </div>
      )}
      {view?.status === 'succeeded' && view.inputArtifactId && view.outputArtifactId && (
        <>
          <CompareSlider
            before={`/api/artifacts/${view.inputArtifactId}`}
            after={`/api/artifacts/${view.outputArtifactId}`}
            beforeLabel="Your photo"
            afterLabel={view.providerMode === 'live' ? `${shadeName}, YouCam render` : `${shadeName}, fixture placeholder`}
          />
          <p className="small" style={{ marginTop: 'var(--space-3)' }}>
            {view.providerMode === 'live'
              ? 'Rendered by YouCam’s makeup try-on with skin smoothing switched off, so only the lips change.'
              : 'Fixture mode: this tint is a placeholder drawn by SkinProof, not a YouCam render.'}{' '}
            A preview shows a colour on one photo; real colour depends on your lips, the light and the batch.
          </p>
        </>
      )}
    </div>
  );
}
