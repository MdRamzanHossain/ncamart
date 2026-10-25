import { NotificationClass } from "./schema";

export const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

const BANGLA_DIGITS: Record<string, string> = {
  "0": "০",
  "1": "১",
  "2": "২",
  "3": "৩",
  "4": "৪",
  "5": "৫",
  "6": "৬",
  "7": "৭",
  "8": "৮",
  "9": "৯",
};

/**
 * Converts Latin digits in a string or number into standard Bangla numerals (০-৯).
 */
export function toBanglaNumerals(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  const str = String(input);
  return str.replace(/[0-9]/g, (digit) => BANGLA_DIGITS[digit] ?? digit);
}

/**
 * Returns when a message of this class may be sent per PRD §3.10 / architechture.md §13.
 * - Class A: Immediate (24/7)
 * - Class B & C: Allowed between 08:00 and 22:00 Asia/Dhaka (UTC+6). If triggered outside,
 *   queued until 08:00 Dhaka wall clock.
 */
export function nextAllowedSendTime(cls: NotificationClass, now = new Date()): Date {
  if (cls === "A") {
    return now;
  }

  // Calculate Dhaka wall-clock date/time
  const dhaka = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const hour = dhaka.getUTCHours();

  if (hour >= 8 && hour < 22) {
    return now;
  }

  const addDay = hour >= 22 ? 1 : 0;
  const next0800DhakaUtcMs =
    Date.UTC(
      dhaka.getUTCFullYear(),
      dhaka.getUTCMonth(),
      dhaka.getUTCDate() + addDay,
      8,
      0,
      0,
      0
    ) - DHAKA_OFFSET_MS;

  return new Date(next0800DhakaUtcMs);
}

/**
 * Specific timing rule for Pre-Order Balance Reminders (PRD §3.10 row 8):
 * Scheduled for 10:00 AM Asia/Dhaka time.
 */
export function computeBalanceReminderTime(now = new Date()): Date {
  const dhaka = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const hour = dhaka.getUTCHours();
  const minute = dhaka.getUTCMinutes();

  const addDay = hour > 10 || (hour === 10 && minute > 0) ? 1 : 0;
  const target1000DhakaUtcMs =
    Date.UTC(
      dhaka.getUTCFullYear(),
      dhaka.getUTCMonth(),
      dhaka.getUTCDate() + addDay,
      10,
      0,
      0,
      0
    ) - DHAKA_OFFSET_MS;

  return new Date(target1000DhakaUtcMs);
}

/**
 * Specific timing rule for Out for Delivery Alert (PRD §3.10 row 7):
 * Morning of delivery (08:00 AM Dhaka if before 08:00, or immediate if daytime).
 */
export function computeOutForDeliveryTime(now = new Date()): Date {
  const dhaka = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const hour = dhaka.getUTCHours();

  if (hour < 8) {
    const morning0800UtcMs =
      Date.UTC(
        dhaka.getUTCFullYear(),
        dhaka.getUTCMonth(),
        dhaka.getUTCDate(),
        8,
        0,
        0,
        0
      ) - DHAKA_OFFSET_MS;
    return new Date(morning0800UtcMs);
  }

  return now;
}

/**
 * Replace {{variables}} in template body/subject with provided values.
 * If locale is "bn", numeric amounts/numbers are automatically converted to Bangla numerals.
 */
export function renderTemplate(
  templateText: string,
  variables: Record<string, unknown>,
  locale: "bn" | "en" = "bn"
): string {
  return templateText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = variables[key];
    if (val === undefined || val === null) {
      return "";
    }
    if (locale === "bn") {
      if (typeof val === "number") {
        return toBanglaNumerals(val);
      }
      if (typeof val === "string" && /^[0-9,.]+$/.test(val)) {
        return toBanglaNumerals(val);
      }
    }
    return String(val);
  });
}
