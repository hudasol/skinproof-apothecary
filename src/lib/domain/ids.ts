const PREFIXES = {
  artifact: 'art',
  consultation: 'con',
  analysis: 'ana',
  decision: 'dec',
  preview: 'prv',
} as const;

export type IdKind = keyof typeof PREFIXES;

/** Random, prefixed ids, so an id in a log or URL says what it refers to. */
export function newId(kind: IdKind): string {
  return `${PREFIXES[kind]}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

/** Ids are used in storage lookups, cookies and URLs; accept only our own shape. */
export function isValidId(value: string, kind?: IdKind): boolean {
  if (!/^[a-z]{3}_[0-9a-f]{20}$/.test(value)) return false;
  return kind ? value.startsWith(`${PREFIXES[kind]}_`) : true;
}
