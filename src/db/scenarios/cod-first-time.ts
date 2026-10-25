import crypto from "node:crypto";
import { ledgerService, postingRules } from "@/modules/ledger";
import { ScenarioResult } from "./types";

export async function runCodFirstTimeScenario(): Promise<ScenarioResult> {
  const events: string[] = [];
  const orderId = `ORD-SCENARIO-COD-${Date.now()}`;
  const courierId = "courier:steadfast";

  // 1. Advance fee paid (Inside Dhaka delivery: ৳80 / 8,000 paisa)
  events.push("1. Customer paid ৳80 advance delivery fee via SSLCommerz/bKash");
  await ledgerService.post(undefined, {
    eventType: "ONLINE_PAYMENT_VALIDATED",
    sourceType: "PAYMENT",
    sourceId: `PAY-ADV-${orderId}`,
    description: `Advance delivery fee paid for COD order ${orderId}`,
    lines: postingRules.ONLINE_PAYMENT_VALIDATED({
      amountPaisa: 8000,
      orderId,
    }),
  });

  // 2. Order packed, sealed, and handed to Steadfast Courier
  events.push("2. Godown technician picked inventory, applied seal NCA-8F2K-9X41, and handed to Steadfast Courier");

  // 3. Delivery completed, COD collected: ৳3,450 (345,000 paisa)
  events.push("3. Steadfast courier delivered parcel and collected ৳3,450 cash from customer");

  // Revenue recognition:
  // Merchandise price: ৳3,450 (VAT incl 5% = ৳164.29 -> 16,429 paisa, net ex-VAT = 328,571 paisa)
  // Delivery fee: ৳80 (8,000 paisa)
  // Debits: Courier COD 1110 (৳3,450) + Customer Advance 2000 (৳80) = ৳3,530
  // Credits: Sales Revenue 4000 (328,571) + VAT Output 2100 (16,429) + Delivery Revenue 4020 (8,000) = ৳3,530
  await ledgerService.post(undefined, {
    eventType: "REVENUE_RECOGNIZED_DELIVERY",
    sourceType: "ORDER",
    sourceId: `REV-${orderId}`,
    description: `Revenue recognized on delivery for order ${orderId}`,
    lines: postingRules.REVENUE_RECOGNIZED_DELIVERY({
      orderId,
      prepaidAdvancesPaisa: 8000,
      courierCodPaisa: 345000,
      courierId,
      revenueExVatPaisa: 328571,
      vatPaisa: 16429,
      deliveryFeePaisa: 8000,
    }),
  });

  // COGS recognition: base cost ৳2,650 (265,000 paisa)
  events.push("4. Recognized COGS (Dr 5000 / Cr 1200) for 1x UGREEN Nexode 65W GaN Charger");
  await ledgerService.post(undefined, {
    eventType: "COGS_RECOGNIZED",
    sourceType: "ORDER",
    sourceId: `COGS-${orderId}`,
    description: `Cost of goods sold for order ${orderId}`,
    lines: postingRules.COGS_RECOGNIZED({
      costPaisa: 265000,
      orderId,
    }),
  });

  const tb = await ledgerService.getTrialBalance();

  return {
    name: "cod-first-time",
    description: "First-time buyer Cash on Delivery order with advance fee and successful courier delivery",
    eventsExecuted: events,
    journalEntriesPosted: 3,
    trialBalance: tb,
  };
}
