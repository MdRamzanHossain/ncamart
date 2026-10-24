import crypto from "node:crypto";
import { sourcingRepo } from "../src/modules/sourcing/repo";
import { sourcingService } from "../src/modules/sourcing/service";
import { Actor } from "../src/lib/http/route";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "../src/lib/outbox";
import { ordersRepo } from "../src/modules/orders/repo";
import { ordersService } from "../src/modules/orders/service";
import { catalogService } from "../src/modules/catalog";
import { ledgerService } from "../src/modules/ledger/service";
import { clearMemoryLedgerForTesting } from "../src/modules/ledger/repo";
import { inventoryRepo } from "../src/modules/inventory/repo";
import { inventoryService } from "../src/modules/inventory/service";
import { financeService } from "../src/modules/finance/service";
import { clearMemoryCountersForTesting } from "../src/db/counters";
import { BusinessError } from "../src/lib/errors";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

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

async function resetState() {
  sourcingService.clearMemoryForTesting();
  ordersService.clearMemoryForTesting();
  catalogService.clearMemoryCatalogForTesting();
  clearMemoryCountersForTesting();
  clearMemoryOutboxForTesting();
  clearMemoryLedgerForTesting();
  inventoryRepo.clearMemoryForTesting();
}

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

async function runAllTests() {
  console.log("=== Running P25 Verification Tests ===");

  // 1. Duplicate sync
  {
    await resetState();
    console.log("Test 1: Duplicate sync is harmless (send same batch 3x)...");
    const floatSession = await sourcingService.issueFloatSession(
      { runner_staff_id: runnerA.id, issued_float_paisa: 1_000_000 },
      financeOfficer
    );
    assert(floatSession.status === "OPEN", "Float session should be OPEN");

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
            amount_paisa: 100_000,
            payment_mode: "CASH" as const,
            receipt_media_id: crypto.randomUUID(),
          },
          recorded_at: new Date().toISOString(),
        },
      ],
    };

    const res1 = await sourcingService.syncMutations(batch, runnerA, "batch-key-1");
    assert(res1.results[0]?.result === "ok", "First sync should be ok");

    const res2 = await sourcingService.syncMutations(batch, runnerA, "batch-key-1");
    assert(res2.results[0]?.result === "duplicate", "Second sync should be duplicate");

    const res3 = await sourcingService.syncMutations(batch, runnerA);
    assert(res3.results[0]?.result === "duplicate", "Third sync should be duplicate");

    const purchases = await sourcingRepo.listRunnerPurchases({ runnerId: runnerA.id });
    assert(purchases.items.length === 1, "Only 1 purchase record should exist");

    const sessionAfter = await sourcingRepo.getFloatSessionById(floatSession.id);
    assert(sessionAfter?.purchasesCashPaisa === 100_000, "Cash purchases should only be incremented once");
    console.log("  -> Passed!");
  }

  // 2. Conflict path
  {
    await resetState();
    console.log("Test 2: Conflict path creates physical stock...");
    await sourcingService.issueFloatSession(
      { runner_staff_id: runnerA.id, issued_float_paisa: 500_000 },
      financeOfficer
    );

    const supplier = await createTestSupplier("Al Madina Machinery", "Stall 102");
    const { sku } = await createTestSku(40_000, 60_000);
    const task = await createTestTask(runnerA.id, supplier.id, sku.id, 1, 40_000);

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
    assert(res.results[0]?.result === "conflict", "Result must be conflict");

    const godownLoc = await inventoryService.getLocationByCode("GODOWN_NAWABPUR");
    const balance = await inventoryRepo.getBalance(sku.id, godownLoc.id);
    assert(balance?.onHand === 1, "Physical stock must be received in GODOWN_NAWABPUR");

    const movements = await inventoryService.listMovements({ skuId: sku.id });
    assert(movements.items.some((m) => m.reason === "RUNNER_CONFLICT_RECEIPT"), "Movement reason must be RUNNER_CONFLICT_RECEIPT");

    const outbox = getMemoryOutbox();
    assert(outbox.some((e) => e.type === "sourcing.purchase_conflict"), "Manager must be notified in outbox");
    console.log("  -> Passed!");
  }

  // 3. Quarantine path
  {
    await resetState();
    console.log("Test 3: Quarantine posts nothing...");
    await sourcingService.issueFloatSession(
      { runner_staff_id: runnerA.id, issued_float_paisa: 500_000 },
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
            device_revoked: true,
          },
          recorded_at: new Date().toISOString(),
        },
      ],
    };

    const res = await sourcingService.syncMutations(batch, runnerA);
    assert(res.results[0]?.result === "quarantined", "Result must be quarantined");

    const purchase = await sourcingRepo.getRunnerPurchaseByClientMutationId(clientMutationId);
    assert(purchase?.syncStatus === "QUARANTINED", "Sync status must be QUARANTINED");
    assert(purchase?.requiresApproval === true, "Requires approval must be true");

    const taskAfter = await sourcingRepo.getRunnerTaskById(task.id);
    assert(taskAfter?.status === "DISPATCHED", "Task status must NOT be modified");

    const entries = await ledgerService.listEntries({});
    assert(!entries.items.some((e) => e.eventType === "RUNNER_CASH_PURCHASE"), "No ledger purchase entry must be posted");
    console.log("  -> Passed!");
  }

  // 4. Variance needs two sign-offs
  {
    await resetState();
    console.log("Test 4: Variance needs two sign-offs...");
    const session = await sourcingService.issueFloatSession(
      { runner_staff_id: runnerA.id, issued_float_paisa: 1_000_000 },
      financeOfficer
    );

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

    await sourcingService.returnFloatSession(runnerA, { returned_paisa: 350_000 });

    const countRes = await sourcingService.countFloatSession(
      session.id,
      { returned_paisa: 350_000, variance_reason: "Shortage ৳500" },
      financeOfficer
    );

    assert(countRes.status === "VARIANCE_REVIEW", "Status must be VARIANCE_REVIEW");
    assert(countRes.variancePaisa === 50_000, "Variance must be 50,000 paisa");

    const signoff1 = await sourcingService.signoffFloatSession(session.id, sourcingManager);
    assert(signoff1.smSignoffBy === sourcingManager.id, "smSignoffBy must be set");
    assert(signoff1.foSignoffBy === null, "foSignoffBy must not be set yet");
    assert(signoff1.status === "VARIANCE_REVIEW", "Status must remain VARIANCE_REVIEW");

    const signoff2 = await sourcingService.signoffFloatSession(session.id, financeOfficer);
    assert(signoff2.foSignoffBy === financeOfficer.id, "foSignoffBy must be set");
    assert(signoff2.status === "CLOSED", "Status must be CLOSED after second signoff");
    console.log("  -> Passed!");
  }

  // 5. Ledger balances per runner sub-ledger
  {
    await resetState();
    console.log("Test 5: Ledger balances per runner sub-ledger...");
    const session = await sourcingService.issueFloatSession(
      { runner_staff_id: runnerB.id, issued_float_paisa: 1_000_000 },
      financeOfficer
    );

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

    await sourcingService.countFloatSession(session.id, { returned_paisa: 350_000 }, financeOfficer);
    await sourcingService.signoffFloatSession(session.id, sourcingManager);
    await sourcingService.signoffFloatSession(session.id, financeOfficer);

    const b = await ledgerService.accountBalance("1020", undefined, runnerB.id);
    assert(b.debitPaisa === 1_000_000, "Total debits must be 1,000,000");
    assert(b.creditPaisa === 1_000_000, "Total credits must be 1,000,000");
    assert(b.netBalancePaisa === 0, "Net balance on runner sub-ledger 1020 must be exactly 0");

    const tb = await ledgerService.trialBalance();
    assert(tb.isBalanced === true, "Trial balance must be balanced");
    console.log("  -> Passed!");
  }

  // 6. Godown receipt
  {
    await resetState();
    console.log("Test 6: Godown receipt receiveRunnerItems...");
    const supplier = await createTestSupplier("Dhaka Hardware", "Stall 107");
    const { sku } = await createTestSku(100_000, 150_000);

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

    const task = await sourcingRepo.createRunnerTask({
      taskNumber: `TSK-GDN-${Date.now()}`,
      taskType: "SOURCING",
      orderId: order.id,
      orderItemId: order.items[0]?.id,
      skuId: sku.id,
      qty: 1,
      supplierId: supplier.id,
      maxUnitPricePaisa: 100_000,
      runnerId: runnerA.id,
      status: "PURCHASED",
      quotedUnitPricePaisa: 100_000,
      dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const res = await sourcingService.receiveRunnerItems([task.id], godownManager);
    assert(res.success === true, "receiveRunnerItems must return success");

    const taskAfter = await sourcingRepo.getRunnerTaskById(task.id);
    assert(taskAfter?.status === "RECEIVED_AT_GODOWN", "Task must be RECEIVED_AT_GODOWN");

    const qcHold = await inventoryService.getLocationByCode("QC_HOLD");
    const bal = await inventoryRepo.getBalance(sku.id, qcHold.id);
    assert(bal?.onHand === 1, "Units must be in QC_HOLD");

    const orderAfter = await ordersRepo.getOrderById(undefined, order.id);
    assert(orderAfter?.status === "AT_GODOWN_QC", "Order must advance to AT_GODOWN_QC");
    console.log("  -> Passed!");
  }

  // 7. Supplier Payables & Payments & Refunds
  {
    await resetState();
    console.log("Test 7: Supplier payables, payments & refunds...");
    const supplier = await createTestSupplier("Banga Motors", "Stall 108");
    const { sku } = await createTestSku(200_000, 250_000);

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

    const payables1 = await financeService.getSupplierPayables(financeOfficer);
    const sp1 = payables1.find((p) => p.supplierId === supplier.id);
    assert(sp1?.payablePaisa === 200_000, "Initial payable must be 200,000");

    await financeService.recordSupplierPayment(
      { supplier_id: supplier.id, amount_paisa: 150_000, method: "BANK" },
      financeOfficer
    );

    const payables2 = await financeService.getSupplierPayables(financeOfficer);
    const sp2 = payables2.find((p) => p.supplierId === supplier.id);
    assert(sp2?.payablePaisa === 50_000, "Remaining payable must be 50,000");

    await financeService.recordSupplierRefund(
      { supplier_id: supplier.id, amount_paisa: 50_000, destination: "CREDIT_NOTE" },
      financeOfficer
    );

    const payables3 = await financeService.getSupplierPayables(financeOfficer);
    const sp3 = payables3.find((p) => p.supplierId === supplier.id);
    assert(sp3?.payablePaisa === 0, "Final payable must be 0");
    console.log("  -> Passed!");
  }

  // 8. Partial unique open session constraint
  {
    await resetState();
    console.log("Test 8: One OPEN float session per runner constraint...");
    await sourcingService.issueFloatSession(
      { runner_staff_id: runnerA.id, issued_float_paisa: 100_000 },
      financeOfficer
    );

    let threw = false;
    try {
      await sourcingService.issueFloatSession(
        { runner_staff_id: runnerA.id, issued_float_paisa: 50_000 },
        financeOfficer
      );
    } catch (err) {
      threw = err instanceof BusinessError;
    }
    assert(threw === true, "Must throw BusinessError when issuing second OPEN float session");
    console.log("  -> Passed!");
  }

  console.log("\n==========================================");
  console.log("ALL P25 VERIFICATION TESTS PASSED SUCCESSFULLY!");
  console.log("==========================================");
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

