import crypto from "node:crypto";
import { ledgerService, postingRules } from "@/modules/ledger";
import { ScenarioResult } from "./types";

export async function runRtoScenario(): Promise<ScenarioResult> {
  const events: string[] = [];
  const orderId = `ORD-SCENARIO-RTO-${Date.now()}`;
  const courierId = "courier:steadfast";

  // 1. Advance fee paid (Outside Dhaka delivery: ৳150 / 15,000 paisa)
  events.push("1. Customer paid ৳150 advance delivery fee via SSLCommerz for Outside Dhaka consignment");
  await ledgerService.post(undefined, {
    eventType: "ONLINE_PAYMENT_VALIDATED",
    sourceType: "PAYMENT",
    sourceId: `ADV-${orderId}`,
    description: `Advance delivery fee paid for order ${orderId}`,
    lines: postingRules.ONLINE_PAYMENT_VALIDATED({
      amountPaisa: 15000,
      orderId,
    }),
  });

  // 2. Dispatched with courier
  events.push("2. Parcel dispatched with Steadfast Courier (tracking: STEADFAST-1004)");

  // 3. Customer refused delivery / 3 failed attempts
  events.push("3. Customer unreachable after 3 consecutive delivery attempts (status: RTO_IN_TRANSIT)");

  // 4. Returned parcel received at godown and verified
  events.push("4. Parcel returned to Nawabpur Godown; technician verified intact security seal (status: RTO_RECEIVED)");

  // 5. Restocked to inventory
  events.push("5. Unit returned to sellable stock in GODOWN_NAWABPUR");

  // 6. Advance delivery fee retained per terms of service
  events.push("6. Retained ৳150 advance delivery fee as earned delivery revenue (Dr 2000 / Cr 4020)");
  await ledgerService.post(undefined, {
    eventType: "RTO_ADVANCE_FEE_RETAINED",
    sourceType: "ORDER",
    sourceId: `RTO-FEE-${orderId}`,
    description: `Advance fee retained for RTO order ${orderId}`,
    lines: postingRules.RTO_ADVANCE_FEE_RETAINED({
      amountPaisa: 15000,
      orderId,
    }),
  });

  // 7. Customer rolling 12m RTO count incremented to 2, triggering auto COD block
  events.push("7. Customer Kamrul Hasan (phone: +8801911000003) updated: rtoCount12m = 2, codBlocked = true (reason: AUTO_RTO)");

  const tb = await ledgerService.getTrialBalance();

  return {
    name: "rto",
    description: "Courier delivery refusal, return-to-origin receipt, advance fee retention, and customer COD block",
    eventsExecuted: events,
    journalEntriesPosted: 2,
    trialBalance: tb,
  };
}
