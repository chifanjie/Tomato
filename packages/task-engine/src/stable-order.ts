/**
 * Compares strings by their UTF-16 code units.
 *
 * Unlike localeCompare, the result is independent of the host locale and ICU
 * collation data, so it is safe for persisted payload order and digest inputs.
 */
export function compareUnicodeCodeUnits(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
