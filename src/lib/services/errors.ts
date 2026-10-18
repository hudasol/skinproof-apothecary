/** An expected, user-facing failure. Its message is safe to show as-is. */
export class AppError extends Error {
  constructor(
    readonly code:
      | 'not_found'
      | 'invalid_input'
      | 'conflict'
      | 'provider_unavailable'
      | 'budget_exceeded'
      | 'not_allowed'
      | 'consent_required',
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(what: string): AppError {
  return new AppError('not_found', `${what} was not found.`);
}
