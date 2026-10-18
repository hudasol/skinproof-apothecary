/** What every form action returns to useActionState. Safe to import from client components. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echo of submitted text values, so a failed form keeps what the person typed. */
  values?: Record<string, string | string[]>;
  /** Extra data for the client, e.g. the id of a job to follow. */
  data?: Record<string, string>;
};

export const initialState: ActionState = { ok: false };
