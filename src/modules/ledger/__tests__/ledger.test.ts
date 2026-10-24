import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { ledgerService } from "../service";
import { postingRules } from "../rules";
import { clearMemoryLedgerForTesting } from "../repo";
import { CHART_OF_ACCOUNTS } from "../accounts";
import { BusinessError, ValidationError } from "@/lib/errors";

describe("P17 — Double-Entry General Ledger Unit & Property Tests", () => {
  beforeEach(() => {
    clearMemoryLedgerForTesting();
  });

  // --------------------------------------------------------------------------
  // 1. Chart of Accounts & Seed Invariants
  // --------------------------------------------------------------------------
  describe("1. Chart of Accounts", () => {
    it("contains all required accounts 1000–5400 from architechture.md §10.2", () => {
      expect(CHART_OF_ACCOUNTS.length).toBe(27);

      const codes = CHART_OF_ACCOUNTS.map((a) => a.code);
      // Assets
      expect(codes).toContain("1000"); // Cash Office
      expect(codes).toContain("1010"); // Cash Drawer
      expect(codes).toContain("1020"); // Cash Runner Float
      expect(codes).toContain("1030"); // Bank
      expect(codes).toContain("1040"); // Merchant Wallet
      expect(codes).toContain("1100"); // SSLCommerz Clearing
      expect(codes).toContain("1110"); // Courier COD Receivable
      expect(codes).toContain("1200"); // Inventory

      // Liabilities
      expect(codes).toContain("2000"); // Customer Advances
      expect(codes).toContain("2010"); // Customer Deposits Pre-Order
      expect(codes).toContain("2020"); // Store Credit
      expect(codes).toContain("2100"); // VAT Payable
      expect(codes).toContain("2200"); // Supplier Payable

      // Equity
      expect(codes).toContain("3000"); // Owner's Equity

      // Income
      expect(codes).toContain("4000"); // Sales Revenue
      expect(codes).toContain("4010"); // Sales Discounts (contra)
      expect(codes).toContain("4020"); // Delivery Fee Revenue
      expect(codes).toContain("4030"); // Forfeited Deposit Income
      expect(codes).toContain("4040"); // Sales Returns (contra)

      // Expenses
      expect(codes).toContain("5000"); // COGS
      expect(codes).toContain("5100"); // Courier Delivery Charges
      expect(codes).toContain("5110"); // COD Charges
      expect(codes).toContain("5120"); // Return / RTO Charges
      expect(codes).toContain("5200"); // Gateway Fees
      expect(codes).toContain("5300"); // Inventory Write-off & Damage
      expect(codes).toContain("5310"); // Cash Variance
      expect(codes).toContain("5400"); // Goodwill & Vouchers
    });

    it("verifies normal sides and sub-ledger requirements", () => {
      const drawer = CHART_OF_ACCOUNTS.find((a) => a.code === "1010");
      expect(drawer?.requiresSubLedger).toBe(true);
      expect(drawer?.normalSide).toBe("DEBIT");

      const storeCredit = CHART_OF_ACCOUNTS.find((a) => a.code === "2020");
      expect(storeCredit?.requiresSubLedger).toBe(true);
      expect(storeCredit?.normalSide).toBe("CREDIT");

      const discounts = CHART_OF_ACCOUNTS.find((a) => a.code === "4010");
      expect(discounts?.isContra).toBe(true);
      expect(discounts?.normalSide).toBe("DEBIT");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Balance Validation & Core Invariants
  // --------------------------------------------------------------------------
  describe("2. Balance Validation & Posting Invariants", () => {
    it("rejects an unbalanced journal entry", async () => {
      await expect(
        ledgerService.post(undefined, {
          eventType: "TEST_UNBALANCED",
          sourceType: "TEST",
          sourceId: "src-1",
          description: "Unbalanced entry test",
          lines: [
            { accountCode: "1000", debitPaisa: 5000, creditPaisa: 0 },
            { accountCode: "4000", debitPaisa: 0, creditPaisa: 4000 }, // 1000 paisa discrepancy!
          ],
        })
      ).rejects.toThrow(BusinessError);

      try {
        await ledgerService.post(undefined, {
          eventType: "TEST_UNBALANCED",
          sourceType: "TEST",
          sourceId: "src-1",
          description: "Unbalanced entry test",
          lines: [
            { accountCode: "1000", debitPaisa: 5000, creditPaisa: 0 },
            { accountCode: "4000", debitPaisa: 0, creditPaisa: 4000 },
          ],
        });
      } catch (err) {
        const bErr = err as BusinessError;
        expect(bErr.code).toBe("ERR_UNBALANCED_JOURNAL_ENTRY");
      }
    });

    it("rejects lines with both debit and credit or negative amounts", async () => {
      await expect(
        ledgerService.post(undefined, {
          eventType: "TEST_TWO_SIDED",
          sourceType: "TEST",
          sourceId: "src-2",
          description: "Two-sided line test",
          lines: [
            { accountCode: "1000", debitPaisa: 5000, creditPaisa: 1000 },
            { accountCode: "4000", debitPaisa: 0, creditPaisa: 4000 },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("enforces sub_ledger_ref for accounts requiring a sub-ledger", async () => {
      // 2000 (Customer Advances) requires a sub-ledger (orderId)
      await expect(
        ledgerService.post(undefined, {
          eventType: "TEST_MISSING_SUBLEDGER",
          sourceType: "TEST",
          sourceId: "src-3",
          description: "Missing subledger test",
          lines: [
            { accountCode: "1100", debitPaisa: 5000, creditPaisa: 0 },
            { accountCode: "2000", debitPaisa: 0, creditPaisa: 5000 }, // Missing subLedgerRef!
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("idempotency: posting the same business event twice returns the existing entry", async () => {
      const input = {
        eventType: "ONLINE_PAYMENT_VALIDATED",
        sourceType: "PAYMENT",
        sourceId: "tran_ssl_12345",
        description: "Payment validated for order ORD-2026-0001",
        lines: postingRules.ONLINE_PAYMENT_VALIDATED({
          amountPaisa: 250000,
          orderId: "order-1",
        }),
      };

      const entry1 = await ledgerService.post(undefined, input);
      expect(entry1.id).toBeDefined();
      expect(entry1.entryNumber).toMatch(/^JRN-\d{8}-\d{5}$/);

      // Post again with exact same eventType, sourceType, sourceId
      const entry2 = await ledgerService.post(undefined, input);
      expect(entry2.id).toBe(entry1.id);
      expect(entry2.entryNumber).toBe(entry1.entryNumber);

      // Check entries list count: exactly 1 entry exists
      const list = await ledgerService.listEntries({
        sourceType: "PAYMENT",
        sourceId: "tran_ssl_12345",
      });
      expect(list.total).toBe(1);
    });

    it("creates a balanced mirror entry upon reversal", async () => {
      const original = await ledgerService.post(undefined, {
        eventType: "GOODWILL_CREDIT_ISSUED",
        sourceType: "STORE_CREDIT",
        sourceId: "sc-entry-1",
        description: "Goodwill credit test",
        lines: postingRules.GOODWILL_CREDIT_ISSUED({
          amountPaisa: 15000,
          customerId: "cust-1",
        }),
      });

      const reversal = await ledgerService.reverse(
        undefined,
        original.id,
        "Customer account corrected"
      );

      expect(reversal.id).toBeDefined();
      expect(reversal.id).not.toBe(original.id);
      expect(reversal.reversalOf).toBe(original.id);
      expect(reversal.eventType).toBe("REVERSAL_GOODWILL_CREDIT_ISSUED");

      // Verify mirror line values (Dr 2020 15,000 / Cr 5400 15,000)
      const line2020 = reversal.lines.find((l) => l.debitPaisa === 15000);
      expect(line2020).toBeDefined();
      const line5400 = reversal.lines.find((l) => l.creditPaisa === 15000);
      expect(line5400).toBeDefined();

      // Net balance on both accounts must now be 0
      const bal2020 = await ledgerService.accountBalance("2020");
      expect(bal2020.netBalancePaisa).toBe(0);

      const bal5400 = await ledgerService.accountBalance("5400");
      expect(bal5400.netBalancePaisa).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Property-Based Testing: All Rule Builders
  // --------------------------------------------------------------------------
  describe("3. Property-Based Testing: Every Posting Rule Builder", () => {
    it("ONLINE_PAYMENT_VALIDATED produces strictly balanced, one-sided positive lines", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }),
          fc.uuid(),
          (amountPaisa, orderId) => {
            const lines = postingRules.ONLINE_PAYMENT_VALIDATED({ amountPaisa, orderId });
            expect(lines.length).toBe(2);
            const sumDebits = lines.reduce((acc, l) => acc + l.debitPaisa, 0);
            const sumCredits = lines.reduce((acc, l) => acc + l.creditPaisa, 0);
            expect(sumDebits).toBe(sumCredits);
            expect(lines.every((l) => (l.debitPaisa === 0) !== (l.creditPaisa === 0))).toBe(true);
            expect(lines.every((l) => l.debitPaisa >= 0 && l.creditPaisa >= 0)).toBe(true);
          }
        )
      );
    });

    it("REVENUE_RECOGNIZED_DELIVERY produces strictly balanced lines for any valid breakdown", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 5000000 }), // revenueExVat
          fc.integer({ min: 0, max: 500000 }), // vat
          fc.integer({ min: 0, max: 20000 }), // deliveryFee
          fc.integer({ min: 0, max: 50000 }), // discount
          (revenueExVat, vat, deliveryFee, discount) => {
            // Total payable = (revenueExVat + vat + deliveryFee) - discount
            const totalCredits = revenueExVat + vat + deliveryFee;
            // Customer payment must satisfy: paid + discount = totalCredits
            const totalPaid = totalCredits - discount;
            if (totalPaid <= 0) return true; // skip non-viable combinations

            // Split totalPaid into prepaid (advance) and courier COD
            const prepaid = Math.floor(totalPaid / 3);
            const cod = totalPaid - prepaid;

            const lines = postingRules.REVENUE_RECOGNIZED_DELIVERY({
              orderId: "order-test",
              prepaidAdvancesPaisa: prepaid,
              courierCodPaisa: cod,
              courierId: "courier-test",
              discountPaisa: discount,
              revenueExVatPaisa: revenueExVat,
              vatPaisa: vat,
              deliveryFeePaisa: deliveryFee,
            });

            const sumDebits = lines.reduce((acc, l) => acc + l.debitPaisa, 0);
            const sumCredits = lines.reduce((acc, l) => acc + l.creditPaisa, 0);
            expect(sumDebits).toBe(sumCredits);
            expect(lines.every((l) => (l.debitPaisa === 0) !== (l.creditPaisa === 0))).toBe(true);
          }
        )
      );
    });

    it("COURIER_PAYOUT_MATCHED produces balanced lines for any fee combination", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 1000000 }),
          fc.integer({ min: 0, max: 20000 }),
          fc.integer({ min: 0, max: 5000 }),
          fc.integer({ min: 0, max: 5000 }),
          (netPayout, deliveryFee, codFee, rtoFee) => {
            const lines = postingRules.COURIER_PAYOUT_MATCHED({
              netPayoutPaisa: netPayout,
              deliveryFeePaisa: deliveryFee,
              codFeePaisa: codFee,
              rtoFeePaisa: rtoFee,
              courierId: "steadfast",
            });

            const sumDebits = lines.reduce((acc, l) => acc + l.debitPaisa, 0);
            const sumCredits = lines.reduce((acc, l) => acc + l.creditPaisa, 0);
            expect(sumDebits).toBe(sumCredits);
            expect(lines.every((l) => (l.debitPaisa === 0) !== (l.creditPaisa === 0))).toBe(true);
          }
        )
      );
    });

    it("GATEWAY_SETTLEMENT_MATCHED produces balanced lines", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000000 }),
          fc.integer({ min: 10, max: 200000 }),
          (netSettlement, fee) => {
            const lines = postingRules.GATEWAY_SETTLEMENT_MATCHED({
              netSettlementPaisa: netSettlement,
              feePaisa: fee,
            });

            const sumDebits = lines.reduce((acc, l) => acc + l.debitPaisa, 0);
            const sumCredits = lines.reduce((acc, l) => acc + l.creditPaisa, 0);
            expect(sumDebits).toBe(sumCredits);
            expect(lines.every((l) => (l.debitPaisa === 0) !== (l.creditPaisa === 0))).toBe(true);
          }
        )
      );
    });

    it("CASH_SHORTAGE and CASH_OVERAGE produce balanced lines", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 500000 }),
          fc.constantFrom<"RUNNER" | "DRAWER">("RUNNER", "DRAWER"),
          (amount, loc) => {
            const shortLines = postingRules.CASH_SHORTAGE({
              amountPaisa: amount,
              location: loc,
              refId: "ref-1",
            });
            expect(shortLines.reduce((acc, l) => acc + l.debitPaisa, 0)).toBe(
              shortLines.reduce((acc, l) => acc + l.creditPaisa, 0)
            );

            const overLines = postingRules.CASH_OVERAGE({
              amountPaisa: amount,
              location: loc,
              refId: "ref-1",
            });
            expect(overLines.reduce((acc, l) => acc + l.debitPaisa, 0)).toBe(
              overLines.reduce((acc, l) => acc + l.creditPaisa, 0)
            );
          }
        )
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. Golden Scenario Test: E-Commerce COD Order Lifecycle
  // --------------------------------------------------------------------------
  describe("4. Golden Scenario Test: Full COD Order Lifecycle", () => {
    it("executes complete lifecycle and matches hand-computed trial balance exactly", async () => {
      const orderId = "01920000-7000-7000-8000-000000000001";
      const courierId = "courier-steadfast-1";

      // Order parameters:
      // Product gross: ৳1,000 (exVat: ৳870 = 87,000 paisa, VAT: ৳130 = 13,000 paisa)
      // Delivery fee: ৳80 = 8,000 paisa
      // Coupon discount: ৳100 = 10,000 paisa
      // Inventory unit cost: ৳600 = 60,000 paisa
      // Total customer payable: (1,000 + 80) - 100 = ৳980 = 98,000 paisa
      // Advance delivery fee paid online: ৳80 = 8,000 paisa
      // Remaining COD collected: ৳900 = 90,000 paisa

      // Step 1: Customer pays ৳80 advance delivery fee online
      await ledgerService.post(undefined, {
        eventType: "ONLINE_PAYMENT_VALIDATED",
        sourceType: "PAYMENT",
        sourceId: "pay_adv_1",
        description: "Advance fee paid online for order",
        lines: postingRules.ONLINE_PAYMENT_VALIDATED({
          amountPaisa: 8000,
          orderId,
        }),
      });

      // Step 2: Gateway settles ৳80 advance fee (fee: ৳2 = 200 paisa, net to bank: ৳78 = 7,800 paisa)
      await ledgerService.post(undefined, {
        eventType: "GATEWAY_SETTLEMENT_MATCHED",
        sourceType: "SETTLEMENT",
        sourceId: "stl_gw_1",
        description: "Gateway settlement received for advance fee",
        lines: postingRules.GATEWAY_SETTLEMENT_MATCHED({
          netSettlementPaisa: 7800,
          feePaisa: 200,
        }),
      });

      // Step 3: Courier delivers order, customer pays remaining ৳900 COD
      // Revenue recognized: Dr 2000 ৳80, Dr 1110 ৳900, Dr 4010 ৳100 / Cr 4000 ৳870, Cr 2100 ৳130, Cr 4020 ৳80
      await ledgerService.post(undefined, {
        eventType: "REVENUE_RECOGNIZED_DELIVERY",
        sourceType: "ORDER",
        sourceId: orderId,
        description: "Revenue recognized upon courier delivery",
        lines: postingRules.REVENUE_RECOGNIZED_DELIVERY({
          orderId,
          prepaidAdvancesPaisa: 8000,
          courierCodPaisa: 90000,
          courierId,
          discountPaisa: 10000,
          revenueExVatPaisa: 87000,
          vatPaisa: 13000,
          deliveryFeePaisa: 8000,
        }),
      });

      // Step 4: COGS recognized for delivered unit (cost: ৳600 = 60,000 paisa)
      await ledgerService.post(undefined, {
        eventType: "COGS_RECOGNIZED",
        sourceType: "SHIPMENT",
        sourceId: "ship_1",
        description: "COGS recognized upon order delivery",
        lines: postingRules.COGS_RECOGNIZED({
          costPaisa: 60000,
        }),
      });

      // Step 5: Courier settles COD payout:
      // Gross COD: ৳900 = 90,000 paisa
      // Delivery charge: ৳80 = 8,000 paisa
      // COD charge: ৳9 = 900 paisa
      // Net to bank: ৳811 = 81,100 paisa
      await ledgerService.post(undefined, {
        eventType: "COURIER_PAYOUT_MATCHED",
        sourceType: "SETTLEMENT",
        sourceId: "stl_courier_1",
        description: "Steadfast payout matched",
        lines: postingRules.COURIER_PAYOUT_MATCHED({
          netPayoutPaisa: 81100,
          deliveryFeePaisa: 8000,
          codFeePaisa: 900,
          courierId,
        }),
      });

      // ----------------------------------------------------------------------
      // Hand-Computed Trial Balance Verification:
      // 1030 (Bank): Dr 7,800 + Dr 81,100 = Dr 88,900
      // 1100 (SSLCommerz): Dr 8,000 - Cr 8,000 = 0
      // 1110 (Courier COD): Dr 90,000 - Cr 90,000 = 0
      // 1200 (Inventory): Cr 60,000
      // 2000 (Customer Advances): Cr 8,000 - Dr 8,000 = 0
      // 2100 (VAT Payable): Cr 13,000
      // 4000 (Sales Revenue): Cr 87,000
      // 4010 (Sales Discounts): Dr 10,000
      // 4020 (Delivery Fee Revenue): Cr 8,000
      // 5000 (COGS): Dr 60,000
      // 5100 (Courier Delivery Charges): Dr 8,000
      // 5110 (COD Charges): Dr 900
      // 5200 (Gateway Fees): Dr 200
      // ----------------------------------------------------------------------

      // Verify individual account balances:
      const bank = await ledgerService.accountBalance("1030");
      expect(bank.netBalancePaisa).toBe(88900); // ৳889

      const sslClearing = await ledgerService.accountBalance("1100");
      expect(sslClearing.netBalancePaisa).toBe(0);

      const courierReceivable = await ledgerService.accountBalance("1110", undefined, courierId);
      expect(courierReceivable.netBalancePaisa).toBe(0);

      const customerAdvances = await ledgerService.accountBalance("2000", undefined, orderId);
      expect(customerAdvances.netBalancePaisa).toBe(0);

      const vatPayable = await ledgerService.accountBalance("2100");
      expect(vatPayable.netBalancePaisa).toBe(13000); // ৳130 credit

      const revenue = await ledgerService.accountBalance("4000");
      expect(revenue.netBalancePaisa).toBe(87000); // ৳870 credit

      const discounts = await ledgerService.accountBalance("4010");
      expect(discounts.netBalancePaisa).toBe(10000); // ৳100 debit (contra income)

      const deliveryRevenue = await ledgerService.accountBalance("4020");
      expect(deliveryRevenue.netBalancePaisa).toBe(8000); // ৳80 credit

      const cogs = await ledgerService.accountBalance("5000");
      expect(cogs.netBalancePaisa).toBe(60000); // ৳600 debit

      const courierCharges = await ledgerService.accountBalance("5100");
      expect(courierCharges.netBalancePaisa).toBe(8000); // ৳80 debit

      const codCharges = await ledgerService.accountBalance("5110");
      expect(codCharges.netBalancePaisa).toBe(900); // ৳9 debit

      const gatewayFees = await ledgerService.accountBalance("5200");
      expect(gatewayFees.netBalancePaisa).toBe(200); // ৳2 debit

      // Grand Trial Balance verification:
      const tb = await ledgerService.trialBalance();
      expect(tb.is_balanced).toBe(true);

      // Expected total debits & credits:
      // Debits: 88,900 (1030) + 10,000 (4010) + 60,000 (5000) + 8,000 (5100) + 900 (5110) + 200 (5200) = 168,000
      // Credits: 60,000 (1200) + 13,000 (2100) + 87,000 (4000) + 8,000 (4020) = 168,000
      expect(tb.total_debits_paisa).toBe(168000);
      expect(tb.total_credits_paisa).toBe(168000);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Account Statement & Sub-Ledger Balances
  // --------------------------------------------------------------------------
  describe("5. Account Statement & Sub-Ledger Balances", () => {
    it("generates an accurate account statement with opening and closing balances", async () => {
      const order1 = "ord-stat-1";
      const order2 = "ord-stat-2";

      // Event 1: Payment for order 1 (৳500)
      await ledgerService.post(undefined, {
        eventType: "ONLINE_PAYMENT_VALIDATED",
        sourceType: "PAYMENT",
        sourceId: "p1",
        description: "Payment 1",
        lines: postingRules.ONLINE_PAYMENT_VALIDATED({
          amountPaisa: 50000,
          orderId: order1,
        }),
      });

      // Event 2: Payment for order 2 (৳300)
      await ledgerService.post(undefined, {
        eventType: "ONLINE_PAYMENT_VALIDATED",
        sourceType: "PAYMENT",
        sourceId: "p2",
        description: "Payment 2",
        lines: postingRules.ONLINE_PAYMENT_VALIDATED({
          amountPaisa: 30000,
          orderId: order2,
        }),
      });

      // Statement for account 2000 (Customer Advances)
      const statement = await ledgerService.getAccountStatement("2000", {});
      expect(statement.account.code).toBe("2000");
      expect(statement.items.length).toBe(2);
      expect(statement.totalCreditsPaisa).toBe(80000);
      expect(statement.closingBalancePaisa).toBe(80000);

      // Filter statement by subLedgerRef (order1)
      const statementOrder1 = await ledgerService.getAccountStatement("2000", {
        subLedgerRef: order1,
      });
      expect(statementOrder1.items.length).toBe(1);
      expect(statementOrder1.closingBalancePaisa).toBe(50000);

      // Sub-ledger breakdown for account 2000
      const subLedgers = await ledgerService.subLedgerBalance("2000");
      expect(subLedgers.length).toBe(2);
      const b1 = subLedgers.find((s) => s.subLedgerRef === order1);
      expect(b1?.netBalancePaisa).toBe(50000);
      const b2 = subLedgers.find((s) => s.subLedgerRef === order2);
      expect(b2?.netBalancePaisa).toBe(30000);
    });
  });
});
