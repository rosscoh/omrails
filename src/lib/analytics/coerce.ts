/**
 * Postgres `count()` and `sum()` return bigint and numeric. The two drivers
 * then disagree about how to represent those in JavaScript: PGlite gives back
 * numbers, postgres.js gives back strings, because a bigint does not always
 * fit in a double and the driver refuses to lose precision silently.
 *
 * Left alone, that difference produces the worst kind of bug — arithmetic that
 * is correct against the local database and concatenates strings in
 * production, so `spend + revenue` becomes "6679012514". Every aggregate read
 * out of a raw query goes through these helpers.
 */

/** Coerce a driver-returned aggregate to a number. Null/undefined -> fallback. */
export function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/** Like num(), but preserves null instead of collapsing it to a number. */
export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = num(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Divide, returning null rather than Infinity or NaN when the divisor is 0. */
export function safeRatio(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (numerator === null || denominator === null) return null;
  if (denominator === 0) return null;
  const ratio = numerator / denominator;
  return Number.isFinite(ratio) ? ratio : null;
}

/** Normalise a Postgres date/timestamp to an ISO "YYYY-MM-DD" string. */
export function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return null;
}
