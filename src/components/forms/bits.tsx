'use client';

import { useFormStatus } from 'react-dom';
import type { ActionState } from '@/app/action-state';

export function SubmitButton({ children, pending, className = 'btn', disabled }: { children: React.ReactNode; pending: string; className?: string; disabled?: boolean }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={isPending || disabled} aria-disabled={isPending || disabled}>
      {isPending ? pending : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div className={`notice ${state.ok ? '' : 'error'}`} role={state.ok ? 'status' : 'alert'}>
      <p>{state.message}</p>
    </div>
  );
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <span className="field-error" id={id}>
      {message}
    </span>
  );
}
