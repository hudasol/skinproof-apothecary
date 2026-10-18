'use client';

import { useActionState } from 'react';
import { retryAnalysisAction } from '@/app/actions';
import { initialState } from '@/app/action-state';
import { FormMessage, SubmitButton } from './bits';

export function RetryForm() {
  const [state, action] = useActionState(retryAnalysisAction, initialState);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <SubmitButton pending="Starting…">Try the analysis again</SubmitButton>
    </form>
  );
}
