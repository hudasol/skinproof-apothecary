'use client';

import { useActionState } from 'react';
import { consentAction, skipPhotoAction } from '@/app/actions';
import { initialState } from '@/app/action-state';
import { FieldError, FormMessage, SubmitButton } from './bits';

export function ConsentForm({ analysisGiven, previewGiven }: { analysisGiven: boolean; previewGiven: boolean }) {
  const [state, action] = useActionState(consentAction, initialState);
  return (
    <>
      <form action={action} noValidate>
        <FormMessage state={state} />
        <fieldset>
          <legend className="visually-hidden">Your agreement</legend>
          <div className="choice-list">
            <label className="choice">
              <input type="checkbox" name="analysisConsent" defaultChecked={analysisGiven} aria-describedby="consent-analysis-detail" />
              <span>
                <strong>Analyse my photo with YouCam Skin AI</strong>
                <span className="small" id="consent-analysis-detail">
                  My photo is sent to Perfect Corp.’s YouCam service to score visible skin concerns. The scores are cosmetic estimates, not a
                  diagnosis.
                </span>
              </span>
            </label>
            <label className="choice">
              <input type="checkbox" name="previewConsent" defaultChecked={previewGiven} aria-describedby="consent-preview-detail" />
              <span>
                <strong>Also use my photo for lip colour try-on</strong>
                <span className="small" id="consent-preview-detail">
                  Optional. When I choose a shade, my photo is sent to YouCam’s makeup try-on. You can agree to this later instead.
                </span>
              </span>
            </label>
          </div>
          <FieldError message={state.fieldErrors?.analysisConsent} />
        </fieldset>
        <div className="actions">
          <SubmitButton pending="Saving…">Agree and continue</SubmitButton>
        </div>
      </form>
      <form action={skipPhotoAction} className="section" style={{ marginTop: 'var(--space-6)' }}>
        <p className="small">Prefer not to share a photo? You can still choose goals and exclusions and get a shortlist.</p>
        <SubmitButton className="btn secondary" pending="Opening…">
          Choose goals without a photo
        </SubmitButton>
      </form>
    </>
  );
}
