import crypto from "node:crypto";
import { ledgerService, postingRules } from "@/modules/ledger";
import { ScenarioResult } from "./types";

export async function runPreorderFullCycleScenario(): Promise<ScenarioResult> {
  const events: string[] = [];
  const orderId = `ORD-SCENARIO-PRE-${Date.now()}`;

  // 1. Pre-order 20% deposit paid online (৳8,400 / 840,000 paisa)
  events.push("1. Customer paid 20% deposit (৳8,400) via SSLCommerz for HIKMICRO PocketE Thermal Camera");
  await ledgerService.post(undefined, {
    eventType: "PREORDER_DEPOSIT_VALIDATED",
    sourceType: "PAYMENT",
    sourceId: `DEP-${orderId}`,
    description: `Pre-order deposit validated for order ${orderId}`,
    lines: postingRules.PREORDER_DEPOSIT_VALIDATED({
      amountPaisa: 840000,
      orderId,
    }),
  });

  // 2. International consignment arrives in Bangladesh godown
  events.push("2. Cargo arrived at Nawabpur Godown (status: ARRIVED_GODOWN)");

  // 3. Pre-dispatch comprehensive QC passes
  events.push("3. Certified technician performed functional test & calibration verification (status: QC_VERIFIED_BALANCE_DUE)");

  // 4. Customer pays remaining 80% balance online (৳33,600 / 3,360,000 paisa)
  events.push("4. Customer notified; completed remaining ৳33,600 balance payment via SSLCommerz");
  await ledgerService.post(undefined, {
    eventType: "ONLINE_PAYMENT_VALIDATED",
    sourceType: "PAYMENT",
    sourceId: `BAL-${orderId}`,
    description: `Pre-order balance payment validated for order ${orderId}`,
    lines: postingRules.ONLINE_PAYMENT_VALIDATED({
      amountPaisa: 3360000,
      orderId,
    }),
  });

  // 5. Final delivery and revenue recognition
  events.push("5. Parcel delivered to customer; compound revenue recognized");
  await ledgerService.post(undefined, {
    eventType: "REVENUE_RECOGNIZED_DELIVERY",
    sourceType: "ORDER",
    sourceId: `REV-${orderId}`,
    description: `Revenue recognized on delivery for pre-order ${orderId}`,
    lines: postingRules.REVENUE_RECOGNIZED_DELIVERY({
      orderId,
      prepaidAdvancesPaisa: 3360000,
      prepaidPreorderDepositsPaisa: 840000,
      revenueExVatPaisa: 4000000, // ৳40,000 net ex-VAT
      vatPaisa: 200000,           // ৳2,000 (5% VAT)
    }),
  });

  // 6. COGS recognition: import procurement cost ৳33,500 (3,350,000 paisa)
  events.push("6. Recognized COGS (Dr 5000 / Cr 1200) for HIKMICRO PocketE (৳33,500)");
  await ledgerService.post(undefined, {
    eventType: "COGS_RECOGNIZED",
    sourceType: "ORDER",
    sourceId: `COGS-${orderId}`,
    description: `Cost of goods sold for pre-order ${orderId}`,
    lines: postingRules.COGS_RECOGNIZED({
      costPaisa: 3350000,
      orderId,
    }),
  });

  const tb = await ledgerService.getTrialBalance();

  return {
    name: "preorder-full-cycle",
    description: "Complete pre-order lifecycle: 20% deposit, customs arrival, balance payment, and delivery",
    eventsExecuted: events,
    journalEntriesPosted: 4,
    trialBalance: tb,
  };
}
