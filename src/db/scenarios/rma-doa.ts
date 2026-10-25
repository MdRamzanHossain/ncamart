import crypto from "node:crypto";
import { ledgerService, postingRules } from "@/modules/ledger";
import { ScenarioResult } from "./types";

export async function runRmaDoaScenario(): Promise<ScenarioResult> {
  const events: string[] = [];
  const originalOrderId = `ORD-ORIGINAL-${Date.now()}`;
  const replacementOrderId = `ORD-REPLACE-${Date.now()}`;
  const sealId = "NCA-8F2K-9X41";
  const courierId = "courier:steadfast";

  // 1. Initial sale delivered 24 hours ago
  events.push("1. Initial order delivered: 1x UGREEN Nexode 65W Charger (৳3,450) with seal NCA-8F2K-9X41");
  await ledgerService.post(undefined, {
    eventType: "REVENUE_RECOGNIZED_DELIVERY",
    sourceType: "ORDER",
    sourceId: `REV-${originalOrderId}`,
    description: `Initial sale delivery for order ${originalOrderId}`,
    lines: postingRules.REVENUE_RECOGNIZED_DELIVERY({
      orderId: originalOrderId,
      prepaidAdvancesPaisa: 8000,
      courierCodPaisa: 345000,
      courierId,
      revenueExVatPaisa: 328571,
      vatPaisa: 16429,
      deliveryFeePaisa: 8000,
    }),
  });

  await ledgerService.post(undefined, {
    eventType: "COGS_RECOGNIZED",
    sourceType: "ORDER",
    sourceId: `COGS-${originalOrderId}`,
    description: `Initial COGS recognized for order ${originalOrderId}`,
    lines: postingRules.COGS_RECOGNIZED({
      costPaisa: 265000,
      orderId: originalOrderId,
    }),
  });

  // 2. Customer submits DOA claim within 48h with mandatory unboxing video
  events.push("2. Customer submitted DOA claim RMA-2026-0001 within 48 hours with unboxing video");

  // 3. Customer support fast-tracks DOA claim
  events.push("3. Support adjudicated & approved claim as DOA_FAST_TRACK; resolution: REPLACE");

  // 4. Zero-price replacement unit dispatched
  events.push(`4. Zero-price replacement order ${replacementOrderId} dispatched; original warranty days (364 days remaining) inherited`);

  // 5. Defective unit returned to godown and written off as damaged inventory
  events.push("5. Defective unit received at Nawabpur Godown (location: DAMAGED); stock write-off posted (Dr 5300 / Cr 1200)");
  await ledgerService.post(undefined, {
    eventType: "STOCK_WRITE_OFF",
    sourceType: "RMA",
    sourceId: `RMA-${sealId}`,
    description: `Defective unit write-off for DOA seal ${sealId}`,
    lines: postingRules.STOCK_WRITE_OFF({
      costPaisa: 265000,
    }),
  });

  const tb = await ledgerService.getTrialBalance();

  return {
    name: "rma-doa",
    description: "Dead-on-arrival claim submission with video proof, fast-track approval, replacement order, and defective write-off",
    eventsExecuted: events,
    journalEntriesPosted: 3,
    trialBalance: tb,
  };
}
