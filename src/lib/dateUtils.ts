/**
 * Date helpers that avoid timezone-shift bugs.
 *
 * The shadcn `Calendar` component returns a `Date` at LOCAL midnight.
 * Calling `.toISOString()` on that converts to UTC, which in any
 * timezone east of UTC (e.g. Sweden CET/CEST) rolls the date back
 * to the previous day. These helpers normalize a calendar day to
 * noon UTC so the ISO string round-trips to the same calendar date
 * everywhere on Earth.
 */

/** YYYY-MM-DD using the date's local components (no timezone shift). */
export const toLocalDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * Convert a calendar-day Date (typically local midnight from a date
 * picker) to an ISO string anchored at 12:00 UTC of the same calendar
 * date. Safe to store in `timestamptz` columns without losing the day.
 */
export const toNoonUtcIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return new Date(Date.UTC(y, m, d, 12, 0, 0)).toISOString();
};

/** Parse a YYYY-MM-DD string into a Date at noon UTC (safe to format). */
export const parseDateKeyNoonUtc = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};
