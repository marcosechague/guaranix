type Defined<T> = { [Key in keyof T]: Exclude<T[Key], undefined> };

/** Drops `undefined` fields so a partial update only touches what was sent. */
export function definedFields<T extends Record<string, unknown>>(input: T): Partial<Defined<T>> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<Defined<T>>;
}
