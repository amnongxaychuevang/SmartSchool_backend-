// All "today" / "this week" logic uses the school's clock (Asia/Vientiane, UTC+7,
// no daylight saving) — never the server's local time zone, which is often UTC in
// production. Dates are still stored as UTC instants; these helpers only decide
// where a school day starts.

const OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Shift an instant so its UTC fields read as Vientiane wall-clock time.
const toLocal = (date: Date) => new Date(date.getTime() + OFFSET_MS);

/** The UTC instant of 00:00 Vientiane time on the day containing `date`. */
export function startOfSchoolDay(date: Date = new Date()): Date {
  const local = toLocal(date);
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(localMidnight - OFFSET_MS);
}

/** Midnight Vientiane time on the Sunday that starts the week containing `date`. */
export function startOfSchoolWeek(date: Date = new Date()): Date {
  const dayStart = startOfSchoolDay(date);
  const weekday = toLocal(dayStart).getUTCDay(); // 0 = Sunday
  return addDays(dayStart, -weekday);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** "YYYY-MM-DD" of `date` on the school's calendar. */
export function schoolDateString(date: Date): string {
  return toLocal(date).toISOString().slice(0, 10);
}

/**
 * The value to store in a `@db.Date` column for the school day containing `date`
 * (or for a "YYYY-MM-DD" string): UTC midnight of that calendar date.
 */
export function schoolDateValue(date: Date | string = new Date()): Date {
  const ymd = typeof date === 'string' ? date.slice(0, 10) : schoolDateString(date);
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Parses "HH:MM" into minutes since midnight. */
export function parseClockTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Minutes since local midnight, e.g. 07:30 → 450. For late-arrival checks. */
export function schoolMinutesOfDay(date: Date): number {
  const local = toLocal(date);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** School years run September → August and are written "2025-2026". */
export function academicYearForDate(date: Date = new Date()): string {
  const local = toLocal(date);
  const year = local.getUTCFullYear();
  const start = local.getUTCMonth() >= 8 ? year : year - 1; // month 8 = September
  return `${start}-${start + 1}`;
}
