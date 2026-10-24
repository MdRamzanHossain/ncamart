import { describe, it, expect, beforeEach } from "vitest";
import { settingsService } from "../service";
import { DEFAULT_SETTINGS } from "../dto";
import { ZodError } from "zod";

describe("settings service unit tests", () => {
  beforeEach(() => {
    settingsService.clearMemoryCacheForTesting();
  });

  it("retrieves default value for unset setting", async () => {
    const defaultDhaka = await settingsService.get("DELIVERY_BASE_DHAKA_PAISA");
    expect(defaultDhaka).toBe(DEFAULT_SETTINGS.DELIVERY_BASE_DHAKA_PAISA);
    expect(defaultDhaka).toBe(8000);

    const defaultQuietStart = await settingsService.get("MARKETING_QUIET_START");
    expect(defaultQuietStart).toBe("22:00");
  });

  it("sets and retrieves custom setting with cache update", async () => {
    await settingsService.set("DELIVERY_BASE_DHAKA_PAISA", 9500, "staff:admin1");
    const updated = await settingsService.get("DELIVERY_BASE_DHAKA_PAISA");
    expect(updated).toBe(9500);
  });

  it("rejects invalid setting values via Zod schema", async () => {
    // Delivery fee cannot be negative
    await expect(
      settingsService.set("DELIVERY_BASE_DHAKA_PAISA", -500 as unknown as number)
    ).rejects.toThrow(ZodError);

    // Basis points cannot exceed 10000 (100%)
    await expect(
      settingsService.set("MIN_MARGIN_BP", 15000 as unknown as number)
    ).rejects.toThrow(ZodError);

    // Marketing quiet start must match HH:MM
    await expect(
      settingsService.set("MARKETING_QUIET_START", "invalid-time" as unknown as string)
    ).rejects.toThrow(ZodError);
  });
});
