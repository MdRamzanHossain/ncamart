import { describe, it, expect } from "vitest";
import {
  toDhaka,
  startOfDhakaDay,
  isDhakaWeekend,
  addBusinessDays,
  nextAllowedSendTime,
  fiscalYearOf,
  DHAKA_OFFSET_MS,
} from "../time";

describe("time.ts unit tests", () => {
  describe("toDhaka and startOfDhakaDay", () => {
    it("converts UTC date to Dhaka (UTC+6) wall clock accurately", () => {
      // 2026-10-21 18:00 UTC -> 2026-10-22 00:00 Dhaka
      const utcDate = new Date("2026-10-21T18:00:00.000Z");
      const dhaka = toDhaka(utcDate);

      expect(dhaka.year).toBe(2026);
      expect(dhaka.month).toBe(10);
      expect(dhaka.day).toBe(22);
      expect(dhaka.hour).toBe(0);
      expect(dhaka.minute).toBe(0);
      expect(DHAKA_OFFSET_MS).toBe(6 * 60 * 60 * 1000);
    });

    it("calculates startOfDhakaDay correctly", () => {
      const utcDate = new Date("2026-10-21T21:30:00.000Z"); // 03:30 Dhaka on Oct 22
      const start = startOfDhakaDay(utcDate);
      expect(start.toISOString()).toBe("2026-10-21T18:00:00.000Z"); // 00:00 Dhaka = 18:00 UTC prev day
    });
  });

  describe("weekend and business days (Friday/Saturday weekend in BD)", () => {
    it("identifies Friday and Saturday as Bangladesh weekend", () => {
      // 2026-10-23 is Friday
      const fridayDhaka = new Date(Date.UTC(2026, 9, 23, 4, 0, 0)); // Friday 10:00 Dhaka
      expect(isDhakaWeekend(fridayDhaka)).toBe(true);

      // 2026-10-24 is Saturday
      const saturdayDhaka = new Date(Date.UTC(2026, 9, 24, 4, 0, 0)); // Saturday 10:00 Dhaka
      expect(isDhakaWeekend(saturdayDhaka)).toBe(true);

      // 2026-10-25 is Sunday (regular working day in BD)
      const sundayDhaka = new Date(Date.UTC(2026, 9, 25, 4, 0, 0));
      expect(isDhakaWeekend(sundayDhaka)).toBe(false);
    });

    it("adds business days skipping Friday and Saturday", () => {
      // Thursday 2026-10-22 + 1 business day -> Sunday 2026-10-25
      const thursday = new Date(Date.UTC(2026, 9, 22, 4, 0, 0));
      const nextBusinessDay = addBusinessDays(thursday, 1);
      const dhaka = toDhaka(nextBusinessDay);

      expect(dhaka.day).toBe(25); // Sunday
      expect(dhaka.weekday).toBe(0);
    });

    it("skips configured business holidays", () => {
      // Thursday 2026-10-22 + 1 business day with Sunday 2026-10-25 as holiday -> Monday 2026-10-26
      const thursday = new Date(Date.UTC(2026, 9, 22, 4, 0, 0));
      const nextDay = addBusinessDays(thursday, 1, ["2026-10-25"]);
      const dhaka = toDhaka(nextDay);

      expect(dhaka.day).toBe(26); // Monday
    });
  });

  describe("nextAllowedSendTime quiet hours (architechture.md §13.2)", () => {
    it("allows Class A anytime (even during midnight quiet hours)", () => {
      // 23:00 Dhaka
      const night = new Date(Date.UTC(2026, 9, 22, 17, 0, 0));
      expect(nextAllowedSendTime("A", night)).toBe(night);
    });

    it("allows Class B during active hours (08:00 to 21:59:59)", () => {
      // 08:00 Dhaka = 02:00 UTC
      const morning8 = new Date(Date.UTC(2026, 9, 22, 2, 0, 0));
      expect(nextAllowedSendTime("B", morning8)).toBe(morning8);

      // 21:59 Dhaka = 15:59 UTC
      const night2159 = new Date(Date.UTC(2026, 9, 22, 15, 59, 0));
      expect(nextAllowedSendTime("B", night2159)).toBe(night2159);
    });

    it("defers at 22:00 Dhaka boundary to next morning 08:00 Dhaka", () => {
      // Exactly 22:00 Dhaka on Oct 22 = 16:00 UTC on Oct 22
      const night2200 = new Date(Date.UTC(2026, 9, 22, 16, 0, 0));
      const allowed = nextAllowedSendTime("B", night2200);

      // Next morning 08:00 Dhaka on Oct 23 = 02:00 UTC on Oct 23
      expect(allowed.toISOString()).toBe("2026-10-23T02:00:00.000Z");
      expect(toDhaka(allowed).hour).toBe(8);
      expect(toDhaka(allowed).day).toBe(23);
    });

    it("defers at 07:59 Dhaka boundary to 08:00 Dhaka same day", () => {
      // 07:59 Dhaka on Oct 22 = 01:59 UTC on Oct 22
      const morning759 = new Date(Date.UTC(2026, 9, 22, 1, 59, 0));
      const allowed = nextAllowedSendTime("B", morning759);

      // 08:00 Dhaka on Oct 22 = 02:00 UTC on Oct 22
      expect(allowed.toISOString()).toBe("2026-10-22T02:00:00.000Z");
      expect(toDhaka(allowed).hour).toBe(8);
      expect(toDhaka(allowed).day).toBe(22);
    });
  });

  describe("fiscalYearOf (Bangladesh July–June fiscal year)", () => {
    it("returns previous-current year on 30 June boundary", () => {
      // 30 June 2026 12:00 Dhaka -> Fiscal Year 2025-2026
      const june30 = new Date(Date.UTC(2026, 5, 30, 6, 0, 0));
      expect(fiscalYearOf(june30)).toBe("2025-2026");
    });

    it("returns current-next year on 1 July boundary", () => {
      // 1 July 2026 00:01 Dhaka -> Fiscal Year 2026-2027
      const july1 = new Date(Date.UTC(2026, 6, 1, 0, 1, 0));
      expect(fiscalYearOf(july1)).toBe("2026-2027");
    });
  });
});
