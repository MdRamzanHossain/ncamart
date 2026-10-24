import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { sourcingRepo } from "../repo";
import { sourcingService } from "../service";
import { Actor } from "@/lib/http/route";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";
import { ordersRepo } from "@/modules/orders/repo";
import { ordersService } from "@/modules/orders/service";
import { catalogService } from "@/modules/catalog";
import { ledgerService } from "@/modules/ledger/service";
import { clearMemoryLedgerForTesting } from "@/modules/ledger/repo";
import { inventoryRepo } from "@/modules/inventory/repo";
import { inventoryService } from "@/modules/inventory/service";
import { financeService } from "@/modules/finance/service";
import { clearMemoryCountersForTesting } from "@/db/counters";
import { BusinessError } from "@/lib/errors";

const financeOfficer: Actor = {
  id: "01920000-0000-7000-8000-0000000000f0",
  type: "staff",
  roles: ["FINANCE_OFFICER"],
};

const sourcingManager: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["SOURCING_MANAGER"],
};

const godownManager: Actor = {
  id: "01920000-0000-7000-8000-000000000002",
  type: "staff",
  roles: ["GODOWN_MANAGER"],
};

const runnerA: Actor = {
  id: "01920000-0000-7000-8000-0000000000aa",
  type: "staff",
  roles: ["FIELD_RUNNER"],
};

const runnerB: Actor = {
  id: "01920000-0000-7000-8000-0000000000bb",
  type: "staff",
  roles: ["FIELD_RUNNER"],
};

describe("P25 — Runner Float Sessions, Purchases & Offline Sync", () => {
  beforeEach(async () => {
    sourcingService.clearMemoryForTesting();
    ordersService.clearMemoryForTesting();
    catalogService.clearMemoryCatalogForTesting();
    clearMemoryCountersForTesting();
    clearMemoryOutboxForTesting();
    clearMemoryLedgerForTesting();
    inventoryRepo.clearMemoryForTesting();
  });

  async function createTestSupplier(name: string, stallNo: string) {
    return sourcingRepo.createSupplier({
      name,
      proprietorName: "Stall Proprietor",
      market: "NAWABPUR_COMPLEX",
      stallNo,
      floor: "Ground Floor",
      phone: "01711000001",
      acceptedPaymentModes: ["CASH", "SUPPLIER_CREDIT"],
      status: "ACTIVE",
    });
  }

  async function createTestSku(costPaisa: number, pricePaisa: number) {
    const category = await catalogService.createCategory({
      slug: `cat-${crypto.randomUUID().slice(0, 8)}`,
      nameEn: "Power Tools",
      nameBn: "পাওয়ার সরঞ্জাম",
      level: 1,
    });

    const product = await catalogService.createProduct(
      {
        titleEn: "Electric Angle Grinder 850W",
        titleBn: "ইলেকট্রিক অ্যাঙ্গেল গ্রাইন্ডার ৮৫০ ওয়াট",
        slug: `grinder-${crypto.randomUUID().slice(0, 8)}`,
        categoryId: category.id,
        productTier: "BUDGET_SMART",
        fulfillmentType: "DROP_AND_PACK",
        vatRateBp: 0,
      },
      sourcingManager
    );

    const sku = await catalogService.createSku(
      {
        productId: product.id,
        skuCode: `GRN-${crypto.randomUUID().slice(0, 6)}`,
        pricePaisa,
        baseCostPaisa: costPaisa,
        weightGrams: 2000,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        warrantyDays: 180,
      },
      sourcingManager
    );
    catalogService.setProductStatusForTesting(product.id, "PUBLISHED");

    return { product, sku };
  }

  async function createTestTask(runnerId: string, supplierId: string, skuId: string, qty: number = 1, costPaisa: number = 50000) {
    return sourcingRepo.createRunnerTask({
      taskNumber: `TSK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      taskType: "SOURCING",
      skuId,
      qty,
      supplierId,
      maxUnitPricePaisa: costPaisa,
      runnerId,
      status: "DISPATCHED",
      dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });
  }

  // --------------------------------------------------------------------------
  // 1. Duplicate sync is harmless (send the same batch 3x)
  // --------------------------------------------------------------------------
  it("duplicate sync is harmless: sending the same batch 3x returns 'duplicate' and posts nothing extra", async () => {
    // 1. Issue float of ৳10,000 (1,000,000 paisa) to runnerA
    const floatSession = await sourcingService.issueFloatSession(
      {
        runner_staff_id: runnerA.id,
        issued_float_paisa: 1_000_000,
      },
      financeOfficer
    );
    expect(floatSession.status).toBe("OPEN");

    const supplier = await createTestSupplier("Bismillah Hardware", "Stall 101");
    const { sku } = await createTestSku(50_000, 70_000);
    const task = await createTestTask(runnerA.id, supplier.id, sku.id, 2, 50_000);

    const clientMutationId = `mut-${crypto.randomUUID()}`;
    const batch = {
      mutations: [
        {
          client_mutation_id: clientMutationId,
          type: "PURCHASE" as const,
          payload: {
            task_id: task.id,
            supplier_id: supplier.id,
            sku_id: sku.id,
            qty: 2,
            unit_cost_paisa: 50_000,
            amount_paisa: 100_000, // ৳1,000
            payment_mode: "CASH" as const,
            receipt_media_id: crypto.randomUUID(),
          },
          recorded_at: new Date().toISOString(),
        },
      ],
    };

    // First sync
    const res1 = await sourcingService.syncMutations(batch, runnerA, "batch-key-1");
    expect(res1.results).toHaveLength(1);
    expect(res1.results[0]?.result).toBe("ok");
    expect(res1.results[0]?.client_mutation_id).toBe(clientMutationId);

    // Second sync (same batch)
    const res2 = await sourcingService.syncMutations(batch, runnerA, "batch-key-1");
    expect(res2.results).toHaveLength(1);
    expect(res2.results[0]?.result).toBe("duplicate");

    // Third sync (same batch without idempotency key to test per-mutation duplicate detection)
    const res3 = await sourcingService.syncMutations(batch, runnerA);
    expect(res3.results).toHaveLength(1);
    expect(res3.results[0]?.result).toBe("duplicate");

    // Verify database state: only 1 purchase row exists
    const purchases = await sourcingRepo.listRunnerPurchases({ runnerId: runnerA.id });
    expect(purchases.items).toHaveLength(1);

    // Float session cash purchases was incremented only once
    const updatedSession = await sourcingRepo.getFloatSessionById(floatSession.id);
    expect(updatedSession?.purchasesCashPaisa).toBe(100_000);

    // Task is marked PURCHASED
    const updatedTask = await sourcingRepo.getRunnerTaskById(task.id);
    expect(updatedTask?.status).toBe("PURCHASED");
    expect(updatedTask?.quotedUnitPricePaisa).toBe(50_000);
  });

  // --------------------------------------------------------------------------
  // 2. Conflict path creates physical stock
  // --------------------------------------------------------------------------
  it("conflict path: task cancelled while offline accepts purchase and receives stock into GODOWN_NAWABPUR", async () => {
    // 1. Issue float
    await sourcingService.issueFloatSession(
      {
        runner_staff_id: runnerA.id,
        issued_float_paisa: 500_000,
      },
      financeOfficer
    );

    const supplier = await createTestSupplier("Al Madina Machinery", "Stall 102");
    const { sku } = await createTestSku(40_000, 60_000);
    const task = await createTestTask(runnerA.id, supplier.id, sku.id, 1, 40_000);

    // Sourcing manager cancels the task while runner was offline
    await sourcingRepo.updateRunnerTask(task.id, { status: "CANCELLED" });

    const clientMutationId = `mut-conflict-${crypto.randomUUID()}`;
    const batch = {
      mutations: [
        {
          client_mutation_id: clientMutationId,
          type: "PURCHASE" as const,
          payload: {
            task_id: task.id,
            supplier_id: supplier.id,
            sku_id: sku.id,
            qty: 1,
            unit_cost_paisa: 40_000,
            amount_paisa: 40_000,
            payment_mode: "CASH" as const,
            receipt_media_id: crypto.randomUUID(),
          },
          recorded_at: new Date().toISOString(),
        },
      ],
    };

    const res = await sourcingService.syncMutations(batch, runnerA);
    expect(res.results).toHaveLength(1);
    expect(res.results[0]?.result).toBe("conflict");

    // Verify purchase saved with sync_status CONFLICT
    const purchase = await sourcingRepo.getRunnerPurchaseByClientMutationId(clientMutationId);
    expect(purchase).not.toBeNull();
    expect(purchase?.syncStatus).toBe("CONFLICT");

    // Verify physical stock received in GODOWN_NAWABPUR
    const godownLoc = await inventoryService.getLocationByCode("GODOWN_NAWABPUR");
    const balance = await inventoryRepo.getBalance(sku.id, godownLoc.id);
    expect(balance?.onHand).toBe(1);

    // Verify movement recorded with reason RUNNER_CONFLICT_RECEIPT
    const movements = await inventoryService.listMovements({ skuId: sku.id });
    expect(movements.items.some((m) => m.reason === "RUNNER_CONFLICT_RECEIPT")).toBe(true);

    // Verify manager notified in outbox
    const outbox = getMemoryOutbox();
    const conflictEvent = outbox.find((e) => e.type === "sourcing.purchase_conflict");
    expect(conflictEvent).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 3. Quarantine posts nothing
  // --------------------------------------------------------------------------
  it("quarantine path: revoked device stores quarantined record and posts nothing to ledger or tasks", async () => {
    await sourcingService.issueFloatSession(
      {
        runner_staff_id: runnerA.id,
        issued_float_paisa: 500_000,
      },
      financeOfficer
    );

    const supplier = await createTestSupplier("Rahman Tools", "Stall 103");
    const { sku } = await createTestSku(30_000, 45_000);
    const task = await createTestTask(runnerA.id, supplier.id, sku.id, 1, 30_000);

    const clientMutationId = `mut-quarantine-${crypto.randomUUID()}`;
    const batch = {
      mutations: [
        {
          client_mutation_id: clientMutationId,
          type: "PURCHASE" as const,
          payload: {
            task_id: task.id,
            supplier_id: supplier.id,
            sku_id: sku.id,
            qty: 1,
            unit_cost_paisa: 30_000,
            amount_paisa: 30_000,
            payment_mode: "CASH" as const,
            device_revoked: true, // Flagged revoked device
          },
          recorded_at: new Date().toISOString(),
        },
      ],
    };

    const res = await sourcingService.syncMutations(batch, runnerA);
    expect(res.results).toHaveLength(1);
    expect(res.results[0]?.result).toBe("quarantined");

    // Verify purchase saved with sync_status QUARANTINED
    const purchase = await sourcingRepo.getRunnerPurchaseByClientMutationId(clientMutationId);
    expect(purchase).not.toBeNull();
    expect(purchase?.syncStatus).toBe("QUARANTINED");
    expect(purchase?.requiresApproval).toBe(true);

    // Task status remains DISPATCHED (not marked PURCHASED)
    const taskAfter = await sourcingRepo.getRunnerTaskById(task.id);
    expect(taskAfter?.status).toBe("DISPATCHED");

    // Float session cash is not incremented
    const session = await sourcingRepo.getActiveFloatSessionForRunner(runnerA.id);
    expect(session?.purchasesCashPaisa).toBe(0);

    // No ledger purchase entry posted
    const entries = await ledgerService.listEntries({});
    expect(entries.items.some((e) => e.eventType === "RUNNER_CASH_PURCHASE")).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 4. Variance needs two sign-offs
  // --------------------------------------------------------------------------
  it("variance review: non-zero variance requires BOTH Sourcing Manager and Finance Officer sign-offs to close", async () => {
    // 1. Issue float ৳10,000 (1,000,000 paisa)
    const session = await sourcingService.issueFloatSession(
      {
        runner_staff_id: runnerA.id,
        issued_float_paisa: 1_000_000,
      },
      financeOfficer
    );

    // 2. Runner makes cash purchases worth ৳6,000 (600,000 paisa)
    const supplier = await createTestSupplier("Bhai Bhai Traders", "Stall 104");
    const { sku } = await createTestSku(600_000, 800_000);
    const task = await createTestTask(runnerA.id, supplier.id, sku.id, 1, 600_000);

    await sourcingService.syncMutations(
      {
        mutations: [
          {
            client_mutation_id: `mut-var-${crypto.randomUUID()}`,
            type: "PURCHASE",
            payload: {
              task_id: task.id,
              supplier_id: supplier.id,
              sku_id: sku.id,
              qty: 1,
              unit_cost_paisa: 600_000,
              amount_paisa: 600_000,
              payment_mode: "CASH",
              receipt_media_id: crypto.randomUUID(),
            },
            recorded_at: new Date().toISOString(),
          },
        ],
      },
      runnerA
    );

    // Expected cash with runner = 1,000,000 - 600,000 = 400,000 paisa (৳4,000).
    // Runner returns ৳3,500 (350,000 paisa) -> ৳500 shortage variance (50,000 paisa).
    await sourcingService.returnFloatSession(runnerA, { returned_paisa: 350_000 });

    const countRes = await sourcingService.countFloatSession(
      session.id,
      {
        returned_paisa: 350_000,
        variance_reason: "Runner lost ৳500 cash in market",
      },
      financeOfficer
    );

    expect(countRes.status).toBe("VARIANCE_REVIEW");
    expect(countRes.variancePaisa).toBe(50_000); // ৳500 shortage
    expect(countRes.closedAt).toBeNull();

    // First sign-off: Sourcing Manager signs off
    const signoff1 = await sourcingService.signoffFloatSession(
      session.id,
      sourcingManager,
      { notes: "Verified lost receipt in market, approved" }
    );
    expect(signoff1.smSignoffBy).toBe(sourcingManager.id);
    expect(signoff1.foSignoffBy).toBeNull();
    expect(signoff1.status).toBe("VARIANCE_REVIEW"); // Not closed yet!

    // Second sign-off: Finance Officer signs off
    const signoff2 = await sourcingService.signoffFloatSession(
      session.id,
      financeOfficer,
      { notes: "Finance signoff complete" }
    );
    expect(signoff2.foSignoffBy).toBe(financeOfficer.id);
    expect(signoff2.status).toBe("CLOSED"); // Now CLOSED!
    expect(signoff2.closedAt).not.toBeNull();

    // Verify ledger posted FLOAT_RETURNED and CASH_SHORTAGE
    const entries = await ledgerService.listEntries({});
    expect(entries.items.some((e) => e.eventType === "FLOAT_RETURNED")).toBe(true);
    expect(entries.items.some((e) => e.eventType === "CASH_SHORTAGE")).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 5. Ledger balances per runner sub-ledger
  // --------------------------------------------------------------------------
  it("ledger balances: runner sub-ledger on Account 1020 zeroes out after float return and shortage posting", async () => {
    // 1. Issue float ৳10,000
    const session = await sourcingService.issueFloatSession(
      {
        runner_staff_id: runnerB.id,
        issued_float_paisa: 1_000_000,
      },
      financeOfficer
    );

    // Initial sub-ledger balance on 1020: Dr 1,000,000
    const b1 = await ledgerService.accountBalance("1020", undefined, runnerB.id);
    expect(b1.debitPaisa).toBe(1_000_000);
    expect(b1.creditPaisa).toBe(0);
    expect(b1.netBalancePaisa).toBe(1_000_000); // ৳10,000 owed

    // 2. Runner makes cash purchases ৳6,000 (600,000 paisa)
    const supplier = await createTestSupplier("Chowdhury Enterprise", "Stall 105");
    const { sku } = await createTestSku(600_000, 750_000);
    const task = await createTestTask(runnerB.id, supplier.id, sku.id, 1, 600_000);

    await sourcingService.syncMutations(
      {
        mutations: [
          {
            client_mutation_id: `mut-bal-${crypto.randomUUID()}`,
            type: "PURCHASE",
            payload: {
              task_id: task.id,
              supplier_id: supplier.id,
              sku_id: sku.id,
              qty: 1,
              unit_cost_paisa: 600_000,
              amount_paisa: 600_000,
              payment_mode: "CASH",
              receipt_media_id: crypto.randomUUID(),
            },
            recorded_at: new Date().toISOString(),
          },
        ],
      },
      runnerB
    );

    // Sub-ledger balance after purchase: Dr 1,000,000, Cr 600,000 -> Net 400,000
    const b2 = await ledgerService.accountBalance("1020", undefined, runnerB.id);
    expect(b2.debitPaisa).toBe(1_000_000);
    expect(b2.creditPaisa).toBe(600_000);
    expect(b2.netBalancePaisa).toBe(400_000);

    // 3. Count returned cash ৳3,500 (350,000 paisa) -> ৳500 shortage
    await sourcingService.countFloatSession(
      session.id,
      { returned_paisa: 350_000 },
      financeOfficer
    );

    // Signoffs by SM and FO
    await sourcingService.signoffFloatSession(session.id, sourcingManager);
    await sourcingService.signoffFloatSession(session.id, financeOfficer);

    // Sub-ledger balance after return (350k) and shortage (50k):
    // Total Credits: 600k + 350k + 50k = 1,000,000
    // Total Debits: 1,000,000
    // Net Balance on Account 1020 for runnerB: EXACTLY 0!
    const b3 = await ledgerService.accountBalance("1020", undefined, runnerB.id);
    expect(b3.debitPaisa).toBe(1_000_000);
    expect(b3.creditPaisa).toBe(1_000_000);
    expect(b3.netBalancePaisa).toBe(0);

    // General ledger trial balance is completely balanced
    const tb = await ledgerService.trialBalance();
    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebitPaisa).toBe(tb.totalCreditPaisa);
  });

  // --------------------------------------------------------------------------
  // 6. Zero variance clean close
  // --------------------------------------------------------------------------
  it("zero variance: float returned with exact cash closes immediately without sign-off", async () => {
    const session = await sourcingService.issueFloatSession(
      {
        runner_staff_id: runnerA.id,
        issued_float_paisa: 200_000,
      },
      financeOfficer
    );

    // Count exact returned amount (200,000 paisa)
    const counted = await sourcingService.countFloatSession(
      session.id,
      { returned_paisa: 200_000 },
      financeOfficer
    );

    expect(counted.status).toBe("CLOSED");
    expect(counted.variancePaisa).toBe(0);
    expect(counted.closedAt).not.toBeNull();

    const balance = await ledgerService.accountBalance("1020", undefined, runnerA.id);
    expect(b3 => balance.netBalancePaisa).toBeDefined();
    expect(balance.netBalancePaisa).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 7. Receipts and Approval Threshold
  // --------------------------------------------------------------------------
  it("purchases > ৳2,000 without receipt require approval; manager approves", async () => {
    await sourcingService.issueFloatSession(
      {
        runner_staff_id: runnerA.id,
        issued_float_paisa: 500_000,
      },
      financeOfficer
    );

    const supplier = await createTestSupplier("Modern Electric", "Stall 106");
    const { sku } = await createTestSku(250_000, 300_000);
    const task = await createTestTask(runnerA.id, supplier.id, sku.id, 1, 250_000);

    // Purchase ৳2,500 (250,000 paisa) without receipt photo
    const res = await sourcingService.syncMutations(
      {
        mutations: [
          {
            client_mutation_id: `mut-appr-${crypto.randomUUID()}`,
            type: "PURCHASE",
            payload: {
              task_id: task.id,
              supplier_id: supplier.id,
              sku_id: sku.id,
              qty: 1,
              unit_cost_paisa: 250_000,
              amount_paisa: 250_000, // > ৳2,000
              payment_mode: "CASH",
              receipt_media_id: null,
            },
            recorded_at: new Date().toISOString(),
          },
        ],
      },
      runnerA
    );

    expect(res.results[0]?.result).toBe("ok");
    const purchaseId = res.results[0]?.server_ids?.purchase_id!;
    const purchase = await sourcingRepo.getRunnerPurchaseById(purchaseId);
    expect(purchase?.receiptMissingFlag).toBe(true);
    expect(purchase?.requiresApproval).toBe(true);

    // SOURCING_MANAGER approves
    const approved = await sourcingService.approvePurchase(purchaseId, sourcingManager);
    expect(approved.requiresApproval).toBe(false);
    expect(approved.approvedBy).toBe(sourcingManager.id);
  });

  // --------------------------------------------------------------------------
  // 8. Godown receipt and order transition
  // --------------------------------------------------------------------------
  it("receiveRunnerItems: moves physical units into QC_HOLD and transitions order to AT_GODOWN_QC", async () => {
    const supplier = await createTestSupplier("Dhaka Hardware", "Stall 107");
    const { sku } = await createTestSku(100_000, 150_000);

    // Create an order in SOURCING status with 1 order item
    const order = await ordersRepo.createOrder(undefined, {
      order: {
        customerId: "01920000-0000-7000-8000-0000000000cc",
        orderNumber: `ORD-${Date.now()}`,
        channel: "ONLINE",
        orderType: "REGULAR_DROP_PACK",
        fulfillmentChannel: "REGULAR_COURIER",
        status: "SOURCING",
        paymentMode: "ONLINE_FULL",
        subtotalPaisa: 150_000,
        totalPayablePaisa: 150_000,
      },
      items: [
        {
          skuId: sku.id,
          productId: sku.productId,
          titleEn: "Item 1",
          titleBn: "আইটেম ১",
          tier: "BUDGET_SMART",
          skuCode: sku.skuCode,
          qty: 1,
          unitPricePaisa: 150_000,
          lineTotalPaisa: 150_000,
          vatRateBp: 0,
          vatPaisa: 0,
          source: "VIRTUAL",
        },
      ],
    });

    const orderItemId = order.items[0]?.id;
    const task = await sourcingRepo.createRunnerTask({
      taskNumber: `TSK-GDN-${Date.now()}`,
      taskType: "SOURCING",
      orderId: order.id,
      orderItemId,
      skuId: sku.id,
      qty: 1,
      supplierId: supplier.id,
      maxUnitPricePaisa: 100_000,
      runnerId: runnerA.id,
      status: "PURCHASED",
      quotedUnitPricePaisa: 100_000,
      dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    // Receive runner items at godown
    const res = await sourcingService.receiveRunnerItems([task.id], godownManager);
    expect(res.success).toBe(true);

    // Check task status is RECEIVED_AT_GODOWN
    const taskAfter = await sourcingRepo.getRunnerTaskById(task.id);
    expect(taskAfter?.status).toBe("RECEIVED_AT_GODOWN");

    // Check inventory balance in QC_HOLD
    const qcHold = await inventoryService.getLocationByCode("QC_HOLD");
    const bal = await inventoryRepo.getBalance(sku.id, qcHold.id);
    expect(bal?.onHand).toBe(1);

    // Check order advanced to AT_GODOWN_QC
    const orderAfter = await ordersRepo.getOrderById(undefined, order.id);
    expect(orderAfter?.status).toBe("AT_GODOWN_QC");
  });

  // --------------------------------------------------------------------------
  // 9. Supplier Payables, Payments & Refunds
  // --------------------------------------------------------------------------
  it("supplier payables: credit purchase increases payable, payment and credit note reduce payable", async () => {
    const supplier = await createTestSupplier("Banga Motors", "Stall 108");
    const { sku } = await createTestSku(200_000, 250_000);

    // 1. Runner makes a SUPPLIER_CREDIT purchase of ৳2,000 (200,000 paisa)
    await sourcingService.syncMutations(
      {
        mutations: [
          {
            client_mutation_id: `mut-cred-${crypto.randomUUID()}`,
            type: "PURCHASE",
            payload: {
              supplier_id: supplier.id,
              sku_id: sku.id,
              qty: 1,
              unit_cost_paisa: 200_000,
              amount_paisa: 200_000,
              payment_mode: "SUPPLIER_CREDIT",
              receipt_media_id: crypto.randomUUID(),
            },
            recorded_at: new Date().toISOString(),
          },
        ],
      },
      runnerA
    );

    // Check payables: supplier owes ৳2,000
    const payables1 = await financeService.getSupplierPayables(financeOfficer);
    const supplierPayable1 = payables1.find((p) => p.supplierId === supplier.id);
    expect(supplierPayable1).toBeDefined();
    expect(supplierPayable1?.payablePaisa).toBe(200_000);

    // 2. Finance pays ৳1,500 by bank
    await financeService.recordSupplierPayment(
      {
        supplier_id: supplier.id,
        amount_paisa: 150_000,
        method: "BANK",
        reference: "CHQ-12345",
      },
      financeOfficer
    );

    // Remaining payable: 200,000 - 150,000 = 50,000 paisa (৳500)
    const payables2 = await financeService.getSupplierPayables(financeOfficer);
    const supplierPayable2 = payables2.find((p) => p.supplierId === supplier.id);
    expect(supplierPayable2?.payablePaisa).toBe(50_000);

    // 3. Supplier gives credit note of ৳500 for rejected goods
    await financeService.recordSupplierRefund(
      {
        supplier_id: supplier.id,
        amount_paisa: 50_000,
        destination: "CREDIT_NOTE",
      },
      financeOfficer
    );

    // Payable is now 0!
    const payables3 = await financeService.getSupplierPayables(financeOfficer);
    const supplierPayable3 = payables3.find((p) => p.supplierId === supplier.id);
    expect(supplierPayable3?.payablePaisa).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 10. Single OPEN float session constraint
  // --------------------------------------------------------------------------
  it("runner can only have one OPEN float session at a time", async () => {
    await sourcingService.issueFloatSession(
      {
        runner_staff_id: runnerA.id,
        issued_float_paisa: 100_000,
      },
      financeOfficer
    );

    // Attempting to open another session for runnerA throws 409 ERR_FLOAT_SESSION_ALREADY_OPEN
    await expect(
      sourcingService.issueFloatSession(
        {
          runner_staff_id: runnerA.id,
          issued_float_paisa: 50_000,
        },
        financeOfficer
      )
    ).rejects.toThrow(BusinessError);
  });
});
