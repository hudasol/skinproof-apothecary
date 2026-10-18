'use client';

import { useActionState } from 'react';
import { previewConsentAction } from '@/app/actions';
import { initialState } from '@/app/action-state';
import { FieldError, FormMessage, SubmitButton } from './bits';

export function PreviewConsentForm({ returnTo }: { returnTo: string }) {
  const [state, action] = useActionState(previewConsentAction, initialState);
  return (
    <form action={action} noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="choice">
        <input type="checkbox" name="previewConsent" />
        <span>
          <strong>Use my photo for lip colour try-on</strong>
          <span className="small">
            When you choose a shade, your photo is sent to Perfect Corp.’s YouCam makeup try-on, which returns an edited copy. SkinProof
            keeps both for a day, then deletes them. Details on the <a href="/privacy">Your data</a> page.
          </span>
        </span>
      </label>
      <FieldError message={state.fieldErrors?.previewConsent} />
      <div className="actions" style={{ marginTop: 'var(--space-4)' }}>
        <SubmitButton pending="Saving…">Agree and continue</SubmitButton>
      </div>
    </form>
  );
}
