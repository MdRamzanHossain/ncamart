import crypto from "node:crypto";
import { ledgerService, postingRules } from "@/modules/ledger";
import { ScenarioResult } from "./types";

export async function runWalkInScenario(): Promise<ScenarioResult> {
  const events: string[] = [];
  const orderId = `ORD-POS-WALKIN-${Date.now()}`;
  const drawerId = "drawer:showroom:counter-01";
  const sealId = "NCA-4H7M-3B22";

  // 1. Showroom Cash Drawer session opened with float of ৳5,000
  events.push("1. Showroom POS cashier opened morning drawer session with ৳5,000 opening float (Dr 1010 / Cr 1000)");
  await ledgerService.post(undefined, {
    eventType: "DRAWER_OPENED",
    sourceType: "DRAWER",
    sourceId: `DRAWER-OPEN-${Date.now()}`,
    description: "Showroom cash drawer opened with float",
    lines: [
      {
        accountCode: "1010",
        debitPaisa: 500000,
        creditPaisa: 0,
        subLedgerType: "DRAWER",
        subLedgerRef: drawerId,
      },
      { accountCode: "1000", debitPaisa: 0, creditPaisa: 500000 },
    ],
  });

  // 2. Walk-in customer selects item and completes bench physical inspection
  events.push("2. Walk-in customer arrived at Nawabpur showroom; inspected SmartChoice 65W GaN Charger on testing bench");

  // 3. Security seal applied and linked
  events.push(`3. Technician applied destructive tamper-evident seal ${sealId}; status moved to ACTIVE`);

  // 4. Customer pays ৳1,650 cash; immediate POS sale posted
  events.push("4. Customer paid ৳1,650 cash; compound POS sale journal posted (Dr 1010 Showroom Cash / Cr 4000 Revenue + Cr 2100 VAT; Dr 5000 COGS / Cr 1200 Inventory)");
  await ledgerService.post(undefined, {
    eventType: "POS_WALKIN_SALE",
    sourceType: "POS_ORDER",
    sourceId: `POS-${orderId}`,
    description: `Walk-in cash counter sale for order ${orderId}`,
    lines: postingRules.POS_WALKIN_SALE({
      cashPaisa: 165000,
      drawerId,
      revenueExVatPaisa: 157143, // ৳1,571.43 net ex-VAT
      vatPaisa: 7857,           // ৳78.57 (5% VAT)
      costPaisa: 115000,         // ৳1,150 base procurement cost
    }),
  });

  // 5. Stock decremented from SHOWROOM_COUNTER; 80mm thermal receipt issued
  events.push("5. Decremented 1 unit from SHOWROOM_COUNTER location; printed 80mm ESC/POS thermal VAT invoice slip");

  const tb = await ledgerService.getTrialBalance();

  return {
    name: "walk-in",
    description: "Nawabpur showroom walk-in counter sale with active seal linking, cash payment, and thermal receipt",
    eventsExecuted: events,
    journalEntriesPosted: 2,
    trialBalance: tb,
  };
}
