'use client';

import { useActionState } from 'react';
import { accessCodeAction } from '@/app/actions';
import { initialState } from '@/app/action-state';
import { FieldError, FormMessage, SubmitButton } from './bits';

export function AccessForm() {
  const [state, action] = useActionState(accessCodeAction, initialState);
  return (
    <form action={action} style={{ maxWidth: '24rem' }}>
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="code">Access code</label>
        <input id="code" name="code" type="password" className="input" autoComplete="off" aria-invalid={!!state.fieldErrors?.code} />
        <FieldError message={state.fieldErrors?.code} />
      </div>
      <SubmitButton pending="Checking…">Unlock live features</SubmitButton>
    </form>
  );
}
