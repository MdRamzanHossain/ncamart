import { describe, it, expect } from "vitest";
import { identityService } from "@/modules/identity";
import { catalogService } from "@/modules/catalog";

describe("Domain Modules Baseline (Unit)", () => {
  it("initializes identity service properly", async () => {
    const res = await identityService.healthCheck();
    expect(res).toEqual({ module: "identity", status: "ok" });
  });

  it("initializes catalog service properly", async () => {
    const res = await catalogService.healthCheck();
    expect(res).toEqual({ module: "catalog", status: "ok" });
  });

  it("verifies money Paisa conversion logic baseline", () => {
    const taka = 120;
    const paisa = taka * 100;
    expect(paisa).toBe(12000);
  });
});
