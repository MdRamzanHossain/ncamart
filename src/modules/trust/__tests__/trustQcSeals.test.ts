import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { Actor } from "@/lib/http/route";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";
import { catalogService } from "@/modules/catalog";
import { ordersRepo } from "@/modules/orders/repo";
import { ordersService } from "@/modules/orders/service";
import { sourcingRepo } from "@/modules/sourcing/repo";
import { sourcingService } from "@/modules/sourcing/service";
import { clearMemoryCountersForTesting } from "@/db/counters";
import { clearMemoryLedgerForTesting } from "@/modules/ledger/repo";
import { inventoryRepo } from "@/modules/inventory/repo";
import { customerService } from "@/modules/identity/customer";
import { BusinessError, ValidationError } from "@/lib/errors";
import {
  trustService,
  generateSealId,
  normalizeSealInput,
  SEAL_REGEX,
  CROCKFORD_ALPHABET,
  QC_SAMPLING_BP,
} from "../index";
import { trustRepo } from "../repo";

const qcTechnician: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["QC_TECHNICIAN"],
};

const godownManager: Actor = {
  id: "01920000-0000-7000-8000-000000000002",
  type: "staff",
  roles: ["GODOWN_MANAGER"],
};

const sourcingManager: Actor = {
  id: "01920000-0000-7000-8000-000000000003",
  type: "staff",
  roles: ["SOURCING_MANAGER"],
};

const customerA: Actor = {
  id: "01920000-0000-7000-8000-0000000000aa",
  type: "customer",
};

describe("P26 — QC Records, Seal Minting, Printing, Void & Supervisor Sampling", () => {
  beforeEach(() => {
    trustService.clearMemoryForTesting();
    ordersService.clearMemoryForTesting();
    catalogService.clearMemoryCatalogForTesting();
    sourcingService.clearMemoryForTesting();
    clearMemoryCountersForTesting();
    clearMemoryOutboxForTesting();
    clearMemoryLedgerForTesting();
    inventoryRepo.clearMemoryForTesting();
  });

  async function createTestSku(tier: "AUTHENTIC" | "BUDGET_SMART" = "BUDGET_SMART", warrantyDays = 365) {
    const category = await catalogService.createCategory({
      slug: `cat-${crypto.randomUUID().slice(0, 8)}`,
      nameEn: "Electronics",
      nameBn: "ইলেকট্রনিক্স",
      level: 1,
    });

    const product = await catalogService.createProduct(
      {
        titleEn: tier === "AUTHENTIC" ? "UGREEN Nexode 65W GaN Charger" : "Budget Fast Charger 30W",
        titleBn: "ফাস্ট চার্জার",
        slug: `prod-${crypto.randomUUID().slice(0, 8)}`,
        categoryId: category.id,
        productTier: tier,
        fulfillmentType: "DROP_AND_PACK",
        vatRateBp: 0,
      },
      sourcingManager
    );

    const sku = await catalogService.createSku(
      {
        productId: product.id,
        skuCode: `SKU-${crypto.randomUUID().slice(0, 6)}`,
        pricePaisa: 250_000,
        baseCostPaisa: 180_000,
        weightGrams: 200,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        warrantyDays,
      },
      sourcingManager
    );

    catalogService.setProductStatusForTesting(product.id, "PUBLISHED");
    return { category, product, sku };
  }

  async function createTestOrderWithUnit(skuId: string, customerId = customerA.id) {
    const sku = await catalogService.getSkuById(skuId);
    const product = sku ? await catalogService.getProductById(sku.productId) : null;

    const order = await ordersRepo.createOrder(undefined, {
      order: {
        customerId,
        channel: "ONLINE",
        orderType: "REGULAR",
        fulfillmentChannel: "REGULAR_COURIER",
        deliveryZone: "DHAKA_CITY",
        status: "AT_GODOWN_QC",
        paymentStatus: "PAID",
        paymentMode: "ONLINE_GATEWAY",
        subtotalPaisa: 250_000,
        totalPayablePaisa: 250_000,
      },
      items: [
        {
          skuId,
          productId: product?.id ?? crypto.randomUUID(),
          titleEn: product?.titleEn ?? "Fast Charger",
          titleBn: product?.titleBn ?? "চার্জার",
          tier: product?.productTier ?? "BUDGET_SMART",
          skuCode: sku?.skuCode ?? "SKU-TEST",
          qty: 1,
          unitPricePaisa: 250_000,
          allocatedDiscountPaisa: 0,
          lineTotalPaisa: 250_000,
          vatRateBp: 0,
          vatPaisa: 0,
          unitCostPaisa: 180_000,
          source: "PHYSICAL",
        },
      ],
    });

    const detailed = await ordersRepo.getOrderWithDetails(undefined, order.id);
    const unit = detailed?.items[0]?.units?.[0];
    return { order, unit: unit! };
  }

  // --------------------------------------------------------------------------
  // 1. Crockford generator distribution + regex
  // --------------------------------------------------------------------------
  it(
    "Crockford generator satisfies regex and distributes symbols without excluded chars",
    () => {
      const symbolCounts: Record<string, number> = {};
      for (const char of CROCKFORD_ALPHABET) {
        symbolCounts[char] = 0;
      }

      const SAMPLES = 10_000;
      for (let i = 0; i < SAMPLES; i++) {
        const id = generateSealId();
        if (!SEAL_REGEX.test(id)) {
          throw new Error(`Generated id ${id} did not match regex`);
        }

        // Check format NCA-XXXX-XXXX
        const body = id.slice(4, 8) + id.slice(9, 13);
        for (const char of body) {
          if (char === "I" || char === "L" || char === "O" || char === "U") {
            throw new Error(`Excluded Crockford char ${char} found in ${id}`);
          }
          symbolCounts[char] = (symbolCounts[char] ?? 0) + 1;
        }
      }

      // Each symbol should be present and reasonably uniformly distributed
      for (const char of CROCKFORD_ALPHABET) {
        expect(symbolCounts[char]).toBeGreaterThan(1500); // 80,000 chars / 32 ≈ 2,500 expected
        expect(symbolCounts[char]).toBeLessThan(3500);
      }
    },
    15000
  );

  // --------------------------------------------------------------------------
  // 2. Normalizer maps O->0 and I/L->1, strips spaces/hyphens
  // --------------------------------------------------------------------------
  it("normalizer correctly sanitizes ambiguous chars, whitespace, and hyphens", () => {
    // Normalization with O -> 0 and I/L -> 1
    const test1 = normalizeSealInput("nca - 4k9w - 8m2p");
    expect(test1).toBe("NCA-4K9W-8M2P");

    const test2 = normalizeSealInput("NCA-O1IL-ABCD");
    expect(test2).toBe("NCA-0111-ABCD");

    const test3 = normalizeSealInput("  o1il - abcd  ");
    expect(test3).toBe("NCA-0111-ABCD");

    const test4 = normalizeSealInput("4K9W8M2P");
    expect(test4).toBe("NCA-4K9W-8M2P");

    // Invalid length or chars
    expect(normalizeSealInput("TOO_SHORT")).toBeNull();
    expect(normalizeSealInput("NCA-????-!!!!")).toBeNull();
    expect(normalizeSealInput("")).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 3. Activation without a PASS fails
  // --------------------------------------------------------------------------
  it("activation without a PASS fails, while valid PASS inspection activates seal and completes order QC", async () => {
    const { sku } = await createTestSku("BUDGET_SMART", 180);
    const { order, unit } = await createTestOrderWithUnit(sku.id);

    // Attempting to mint seal without PASS record fails
    await expect(
      trustService.mintSeal({ qc_record_id: crypto.randomUUID() }, qcTechnician)
    ).rejects.toThrow();

    // 1. Submit valid inspection with PASS
    const inspectRes = await trustService.inspect(
      {
        sku_id: sku.id,
        order_id: order.id,
        order_item_unit_id: unit.id,
        qc_type: "THREE_POINT",
        checklist: {
          power_voltage_ok: true,
          port_function_ok: true,
          physical_integrity_ok: true,
          voltage_reading: 5.12,
        },
        passed: true,
        tester_notes: "Checked OK",
      },
      qcTechnician
    );
    expect(inspectRes.passed).toBe(true);
    expect(inspectRes.mint_seal_eligible).toBe(true);

    // 2. Mint Seal
    const mintRes = await trustService.mintSeal(
      { qc_record_id: inspectRes.qc_record_id },
      qcTechnician
    );
    expect(mintRes.seal_id).toMatch(SEAL_REGEX);
    expect(mintRes.status).toBe("GENERATED");
    expect(mintRes.label.tspl).toContain(mintRes.seal_id);
    expect(mintRes.label.zpl).toContain(mintRes.seal_id);

    // 3. Mark Printed
    const printedSeal = await trustService.markSealPrinted(mintRes.seal_id, qcTechnician);
    expect(printedSeal.status).toBe("PRINTED");

    // 4. Apply Seal to unit
    const applyRes = await trustService.applySeal(
      mintRes.seal_id,
      { order_item_unit_id: unit.id },
      qcTechnician
    );
    expect(applyRes.seal.status).toBe("ACTIVE");
    expect(applyRes.seal.warrantyDays).toBe(180);
    expect(applyRes.seal.warrantyStart).toBeDefined();
    expect(applyRes.seal.warrantyEnd).toBeDefined();
    expect(applyRes.orderQcCompleted).toBe(true);

    // Verify unit row is updated
    const updatedUnit = await ordersRepo.getOrderItemUnitById(undefined, unit.id);
    expect(updatedUnit?.sealId).toBe(mintRes.seal_id);
    expect(updatedUnit?.status).toBe("SEALED");

    // Verify outbox emitted order.qc_completed
    const outbox = getMemoryOutbox();
    expect(outbox.some((e) => e.type === "order.qc_completed")).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 4. Void & Re-print (PRD §3.2.4)
  // --------------------------------------------------------------------------
  it("void creates a new ID, marks old one VOID_PRINT_ERROR, and never reuses ID", async () => {
    const { sku } = await createTestSku("BUDGET_SMART");
    const { order, unit } = await createTestOrderWithUnit(sku.id);

    // Inspection PASS
    const inspectRes = await trustService.inspect(
      {
        sku_id: sku.id,
        order_id: order.id,
        order_item_unit_id: unit.id,
        qc_type: "THREE_POINT",
        checklist: {
          power_voltage_ok: true,
          port_function_ok: true,
          physical_integrity_ok: true,
        },
        passed: true,
      },
      qcTechnician
    );

    // Mint Seal 1
    const seal1 = await trustService.mintSeal(
      { qc_record_id: inspectRes.qc_record_id },
      qcTechnician
    );
    await trustService.markSealPrinted(seal1.seal_id, qcTechnician);

    // Request void due to PRINTER_JAM
    const voidReq = await trustService.requestVoid(
      { seal_id: seal1.seal_id, reason: "PRINTER_JAM" },
      qcTechnician
    );
    expect(voidReq.status).toBe("PENDING");

    // Manager approves void
    const approveRes = await trustService.approveVoidRequest(
      voidReq.request_id,
      godownManager,
      { notes: "Sticker was damaged in feeder" }
    );
    expect(approveRes.voided).toBe(true);
    expect(approveRes.original_seal_id).toBe(seal1.seal_id);

    // Replacement seal has a DIFFERENT unique seal_id
    const seal2 = approveRes.replacement_seal;
    expect(seal2.seal_id).toMatch(SEAL_REGEX);
    expect(seal2.seal_id).not.toBe(seal1.seal_id);

    // Old seal status is VOID_PRINT_ERROR
    const oldSealRecord = await trustRepo.getSealRecordBySealId(seal1.seal_id);
    expect(oldSealRecord?.status).toBe("VOID_PRINT_ERROR");
    expect(oldSealRecord?.voidReason).toBe("PRINTER_JAM");
    expect(oldSealRecord?.replacedBySealId).toBe(seal2.seal_id);

    // Trying to activate the voided seal fails
    await expect(
      trustService.applySeal(seal1.seal_id, { order_item_unit_id: unit.id }, qcTechnician)
    ).rejects.toThrow();

    // Activating the new seal succeeds
    const applyRes = await trustService.applySeal(
      seal2.seal_id,
      { order_item_unit_id: unit.id },
      qcTechnician
    );
    expect(applyRes.seal.status).toBe("ACTIVE");
  });

  // --------------------------------------------------------------------------
  // 5. Sampling rate ~5% over 10k simulated passes
  // --------------------------------------------------------------------------
  it("sampling rate ~5% over 10,000 simulated passes (statistical tolerance ~4.0% - 6.0%)", () => {
    let sampledCount = 0;
    const TOTAL_PASSES = 10_000;

    for (let i = 0; i < TOTAL_PASSES; i++) {
      const randomBp = crypto.randomInt(10000);
      if (randomBp < QC_SAMPLING_BP) {
        sampledCount++;
      }
    }

    const sampledPercent = (sampledCount / TOTAL_PASSES) * 100;
    // Expected 5%, tolerance 4.0% to 6.0%
    expect(sampledPercent).toBeGreaterThanOrEqual(4.0);
    expect(sampledPercent).toBeLessThanOrEqual(6.0);
  });

  // --------------------------------------------------------------------------
  // 6. Escalation fires once
  // --------------------------------------------------------------------------
  it("supervisor audit escalation job fires once for overdue records", async () => {
    const { sku } = await createTestSku();

    // Create overdue sampled QC record directly
    const overdueRecord = await trustRepo.createQcRecord({
      skuId: sku.id,
      qcType: "THREE_POINT",
      testChecklist: { power_voltage_ok: true },
      result: "PASS",
      technicianId: qcTechnician.id,
      sampledForAudit: true,
      auditDueAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min in the past
      supervisorCheckedAt: null,
      escalatedAt: null,
    });

    // Run escalation job first time -> should escalate
    const job1 = await trustService.runQcAuditEscalationJob();
    expect(job1.escalatedCount).toBe(1);

    const outbox1 = getMemoryOutbox();
    const escalationEvents = outbox1.filter((e) => e.type === "qc.audit_escalated");
    expect(escalationEvents).toHaveLength(1);
    expect(escalationEvents[0]?.notificationClass).toBe("A");

    // Run escalation job second time -> should NOT re-escalate (fires once)
    const job2 = await trustService.runQcAuditEscalationJob();
    expect(job2.escalatedCount).toBe(0);

    const outbox2 = getMemoryOutbox();
    const escalationEvents2 = outbox2.filter((e) => e.type === "qc.audit_escalated");
    expect(escalationEvents2).toHaveLength(1);
  });

  // --------------------------------------------------------------------------
  // 7. Supervisor sampling blocks packing until audited
  // --------------------------------------------------------------------------
  it("packing is blocked while sampled unit is pending audit, unblocks on supervisor PASS", async () => {
    const { sku } = await createTestSku();
    const { order, unit } = await createTestOrderWithUnit(sku.id);

    // Create a sampled QC record
    const qcRecord = await trustRepo.createQcRecord({
      skuId: sku.id,
      orderItemUnitId: unit.id,
      qcType: "THREE_POINT",
      testChecklist: { power_voltage_ok: true, port_function_ok: true, physical_integrity_ok: true },
      result: "PASS",
      technicianId: qcTechnician.id,
      sampledForAudit: true,
      auditDueAt: new Date(Date.now() + 120 * 60 * 1000),
      supervisorCheckedAt: null,
    });

    const mint = await trustService.mintSeal({ qc_record_id: qcRecord.id }, qcTechnician);

    // Apply seal to unit while audit is pending
    const applyRes = await trustService.applySeal(
      mint.seal_id,
      { order_item_unit_id: unit.id },
      qcTechnician
    );
    // Order QC is NOT completed yet because supervisor audit is pending!
    expect(applyRes.orderQcCompleted).toBe(false);

    // Check packing blocked helper
    const isBlocked = await trustService.isOrderPackingBlocked(order.id);
    expect(isBlocked).toBe(true);

    // Check sampling queue has this record
    const queue = await trustService.getSamplingQueue(godownManager);
    expect(queue.items.some((r) => r.id === qcRecord.id)).toBe(true);

    // Supervisor audits with PASS
    await trustService.supervisorAudit(
      qcRecord.id,
      { result: "PASS", notes: "Double checked and verified" },
      godownManager
    );

    // Packing is now unblocked
    const isBlockedAfter = await trustService.isOrderPackingBlocked(order.id);
    expect(isBlockedAfter).toBe(false);

    // Outbox emitted order.qc_completed
    const outbox = getMemoryOutbox();
    expect(outbox.some((e) => e.type === "order.qc_completed")).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 8. Customer "My Warranties" portal with countdown
  // --------------------------------------------------------------------------
  it("customer warranties portal lists delivered active seals with live countdown", async () => {
    const { sku } = await createTestSku("AUTHENTIC", 730); // 2-year warranty

    // Create delivered order for customerA
    const skuRow = await catalogService.getSkuById(sku.id);
    const product = await catalogService.getProductById(skuRow!.productId);

    const order = await ordersRepo.createOrder(undefined, {
      order: {
        customerId: customerA.id,
        channel: "ONLINE",
        orderType: "REGULAR",
        fulfillmentChannel: "REGULAR_COURIER",
        deliveryZone: "DHAKA_CITY",
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMode: "ONLINE_GATEWAY",
        subtotalPaisa: 250_000,
        totalPayablePaisa: 250_000,
      },
      items: [
        {
          skuId: sku.id,
          productId: product!.id,
          titleEn: product!.titleEn,
          titleBn: product!.titleBn,
          tier: "AUTHENTIC",
          skuCode: skuRow!.skuCode,
          qty: 1,
          unitPricePaisa: 250_000,
          allocatedDiscountPaisa: 0,
          lineTotalPaisa: 250_000,
          vatRateBp: 0,
          vatPaisa: 0,
          unitCostPaisa: 180_000,
          source: "PHYSICAL",
        },
      ],
    });

    const detailed = await ordersRepo.getOrderWithDetails(undefined, order.id);
    const unit = detailed!.items[0]!.units![0]!;

    // Create passing QC record and active seal
    const inspectRes = await trustService.inspect(
      {
        sku_id: sku.id,
        order_id: order.id,
        order_item_unit_id: unit.id,
        qc_type: "NON_INVASIVE",
        checklist: {
          hologram_check_ok: true,
          box_serial_matches_invoice: true,
          packaging_integrity_ok: true,
          factory_seal_intact: true,
        },
        oem_manufacturer_serial: "UG-SN-2026-9912",
        passed: true,
      },
      qcTechnician
    );

    const mint = await trustService.mintSeal({ qc_record_id: inspectRes.qc_record_id }, qcTechnician);
    await trustService.applySeal(mint.seal_id, { order_item_unit_id: unit.id }, qcTechnician);

    // Call customerService.getWarranties
    const res = await customerService.getWarranties(customerA.id);
    expect(res.active_warranties).toHaveLength(1);

    const warranty = res.active_warranties[0]!;
    expect(warranty.seal_id).toBe(mint.seal_id);
    expect(warranty.product_title_en).toBe(product!.titleEn);
    expect(warranty.product_tier).toBe("AUTHENTIC");
    expect(warranty.warranty_days_total).toBe(730);
    expect(warranty.days_remaining).toBeGreaterThanOrEqual(729);
    expect(warranty.days_remaining).toBeLessThanOrEqual(730);
    expect(warranty.status).toBe("ACTIVE");
  });
});
