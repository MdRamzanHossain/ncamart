/**
 * Asia/Dhaka time helpers. Dhaka is UTC+6 with no DST, so a fixed offset is exact.
 * Storage is always UTC; Dhaka is used only for business schedules.
 */

export const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type NotificationClass = "A" | "B" | "C";

export interface DhakaParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 5 = Friday, 6 = Saturday */
  weekday: number;
}

export function nowUtc(): Date {
  return new Date();
}

export function toDhaka(date: Date): DhakaParts {
  const d = new Date(date.getTime() + DHAKA_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  };
}

/** "YYYY-MM-DD" of the Dhaka calendar date. */
export function dhakaDateKey(date: Date): string {
  const p = toDhaka(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** UTC instant of 00:00 Dhaka on the same Dhaka calendar day. */
export function startOfDhakaDay(date: Date): Date {
  const p = toDhaka(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - DHAKA_OFFSET_MS);
}

/** Friday and Saturday are the Bangladesh weekend. */
export function isDhakaWeekend(date: Date): boolean {
  const wd = toDhaka(date).weekday;
  return wd === 5 || wd === 6;
}

/**
 * Adds n business days (skipping Fri/Sat and the given holidays as "YYYY-MM-DD" Dhaka dates).
 * Keeps the Dhaka time of day. n must be a non-negative integer.
 * TODO(P03): holidays come from settings BUSINESS_HOLIDAYS.
 */
export function addBusinessDays(date: Date, n: number, holidays: readonly string[] = []): Date {
  if (!Number.isInteger(n) || n < 0) throw new RangeError("n must be a non-negative integer");
  const holidaySet = new Set(holidays);
  let cursor = date;
  let added = 0;
  while (added < n) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (!isDhakaWeekend(cursor) && !holidaySet.has(dhakaDateKey(cursor))) added++;
  }
  return cursor;
}

/**
 * Returns when a message of this class may be sent: now, or the next 08:00 Dhaka.
 * Class A ignores quiet hours. Copied from architechture.md §13.2.
 * Class C additionally requires marketing_opt_in (checked by the notifications module).
 */
export function nextAllowedSendTime(cls: NotificationClass, now: Date = new Date()): Date {
  if (cls === "A") return now;
  const dhaka = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const hour = dhaka.getUTCHours();
  if (hour >= 8 && hour < 22) return now;
  const addDay = hour >= 22 ? 1 : 0;
  const next0800DhakaUtcMs =
    Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate() + addDay, 8, 0, 0) -
    DHAKA_OFFSET_MS;
  return new Date(next0800DhakaUtcMs);
}

/** Bangladesh fiscal year (July–June) of a Dhaka date, e.g. "2026-2027". */
export function fiscalYearOf(date: Date): string {
  const { year, month } = toDhaka(date);
  const start = month >= 7 ? year : year - 1;
  return `${start}-${start + 1}`;
}
