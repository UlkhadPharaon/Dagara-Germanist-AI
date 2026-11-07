/**
 * Small helpers shared by the test suites.
 *
 * They exist because `noUncheckedIndexedAccess` types `array[0]` as
 * `T | undefined`: a failing expectation here means the payload under test was
 * empty, which is exactly what the test is asserting about.
 */

/** Returns the first element of a non-empty array. */
export function first<T>(items: readonly T[] | undefined, label = 'élément'): T {
  const item = items?.[0];
  if (item === undefined) throw new Error(`Aucun ${label} dans la réponse testée.`);
  return item;
}

/** Returns the first call arguments of a spy, or throws. */
export function firstCall<S>(spy: { mock: { calls: unknown[][] } }): S {
  const call = spy.mock.calls[0];
  if (!call) throw new Error("Le mock espionné n'a jamais été appelé.");
  return call as unknown as S;
}

/** Deletes an optional key without tripping `delete` on a required property. */
export function withoutKey<T extends object, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const copy: Partial<T> = { ...source };
  delete copy[key];
  return copy as Omit<T, K>;
}
