import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { runSeeds } from "../seed";
import { runCodFirstTimeScenario } from "../scenarios/cod-first-time";
import { runPreorderFullCycleScenario } from "../scenarios/preorder-full-cycle";
import { runRtoScenario } from "../scenarios/rto";
import { runRmaDoaScenario } from "../scenarios/rma-doa";
import { runWalkInScenario } from "../scenarios/walk-in";
import { ledgerService } from "@/modules/ledger";
import { parseCsv, extractCourierLines } from "@/modules/finance/csv-parser";

describe("P41 — Seed Data & Dev Fixtures", () => {
  beforeEach(async () => {
    ledgerService.clearMemoryForTesting();
    await ledgerService.seedChartOfAccounts();
  });

  describe("1. Database Seeder (pnpm db:seed)", () => {
    it("runs idempotently and populates all required domain fixtures", async () => {
      // First run
      const summary1 = await runSeeds();

      expect(summary1.settingsSeeded).toBe(true);
      expect(summary1.ledgerAccountsSeeded).toBe(true);
      expect(summary1.locationsSeeded).toBe(true);
      expect(summary1.staffSeeded).toBeGreaterThanOrEqual(10);
      expect(summary1.categoriesSeeded).toBeGreaterThanOrEqual(6);
      expect(summary1.brandsSeeded).toBeGreaterThanOrEqual(8);
      expect(summary1.comparisonGroupsSeeded).toBeGreaterThanOrEqual(3);
      expect(summary1.productsSeeded).toBeGreaterThanOrEqual(40);
      expect(summary1.skusSeeded).toBeGreaterThanOrEqual(40);
      expect(summary1.suppliersSeeded).toBeGreaterThanOrEqual(5);
      expect(summary1.customersSeeded).toBeGreaterThanOrEqual(4);
      expect(summary1.couponsSeeded).toBeGreaterThanOrEqual(2);
      expect(summary1.sealsSeeded).toBeGreaterThanOrEqual(4);
      expect(summary1.ordersSeeded).toBeGreaterThanOrEqual(5);
      expect(summary1.rmaClaimsSeeded).toBeGreaterThanOrEqual(1);

      // Second run (Idempotency test)
      const summary2 = await runSeeds();
      expect(summary2).toBeDefined();
    });
  });

  describe("2. End-to-End Dev Scenarios (pnpm dev:scenario <name>)", () => {
    it("simulates cod-first-time and yields a balanced trial balance", async () => {
      const res = await runCodFirstTimeScenario();

      expect(res.name).toBe("cod-first-time");
      expect(res.eventsExecuted.length).toBeGreaterThanOrEqual(3);
      expect(res.journalEntriesPosted).toBe(3);
      expect(res.trialBalance.isBalanced).toBe(true);
      expect(res.trialBalance.totalDebitPaisa).toBe(res.trialBalance.totalCreditPaisa);
      expect(res.trialBalance.totalDebitPaisa).toBeGreaterThan(0);
    });

    it("simulates preorder-full-cycle and yields a balanced trial balance", async () => {
      const res = await runPreorderFullCycleScenario();

      expect(res.name).toBe("preorder-full-cycle");
      expect(res.eventsExecuted.length).toBeGreaterThanOrEqual(5);
      expect(res.journalEntriesPosted).toBe(4);
      expect(res.trialBalance.isBalanced).toBe(true);
      expect(res.trialBalance.totalDebitPaisa).toBe(res.trialBalance.totalCreditPaisa);
      expect(res.trialBalance.totalDebitPaisa).toBeGreaterThan(0);
    });

    it("simulates rto with advance fee retention and yields a balanced trial balance", async () => {
      const res = await runRtoScenario();

      expect(res.name).toBe("rto");
      expect(res.eventsExecuted.length).toBeGreaterThanOrEqual(5);
      expect(res.journalEntriesPosted).toBe(2);
      expect(res.trialBalance.isBalanced).toBe(true);
      expect(res.trialBalance.totalDebitPaisa).toBe(res.trialBalance.totalCreditPaisa);
      expect(res.trialBalance.totalDebitPaisa).toBeGreaterThan(0);
    });

    it("simulates rma-doa replacement flow and yields a balanced trial balance", async () => {
      const res = await runRmaDoaScenario();

      expect(res.name).toBe("rma-doa");
      expect(res.eventsExecuted.length).toBeGreaterThanOrEqual(5);
      expect(res.journalEntriesPosted).toBe(3);
      expect(res.trialBalance.isBalanced).toBe(true);
      expect(res.trialBalance.totalDebitPaisa).toBe(res.trialBalance.totalCreditPaisa);
      expect(res.trialBalance.totalDebitPaisa).toBeGreaterThan(0);
    });

    it("simulates walk-in showroom POS cash sale and yields a balanced trial balance", async () => {
      const res = await runWalkInScenario();

      expect(res.name).toBe("walk-in");
      expect(res.eventsExecuted.length).toBeGreaterThanOrEqual(4);
      expect(res.journalEntriesPosted).toBe(2);
      expect(res.trialBalance.isBalanced).toBe(true);
      expect(res.trialBalance.totalDebitPaisa).toBe(res.trialBalance.totalCreditPaisa);
      expect(res.trialBalance.totalDebitPaisa).toBeGreaterThan(0);
    });
  });

  describe("3. Fixture Validation", () => {
    it("validates courier settlement CSV fixture exists and parses accurately", () => {
      const fixturePath = path.resolve(
        process.cwd(),
        "src/db/seed/fixtures/courier_settlement.csv"
      );
      expect(fs.existsSync(fixturePath)).toBe(true);

      const rawCsv = fs.readFileSync(fixturePath, "utf-8");
      const parsedRows = parseCsv(rawCsv);
      expect(parsedRows.length).toBe(5);

      const lines = extractCourierLines(parsedRows, "steadfast");
      expect(lines.length).toBe(5);
      expect(lines[0]!.consignmentNo).toBe("STEADFAST-1001");
      expect(lines[0]!.collectedPaisa).toBe(345000);
      expect(lines[0]!.deliveryChargePaisa).toBe(8000);
      expect(lines[0]!.codChargePaisa).toBe(3500);
    });
  });
});
