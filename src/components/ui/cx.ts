/**
 * Joins class names, dropping anything falsy.
 * Kept local to the UI kit so components do not need a runtime dependency.
 */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
