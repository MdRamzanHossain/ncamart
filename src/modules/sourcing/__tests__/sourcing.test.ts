import { describe, it, expect, beforeEach } from "vitest";
import { sourcingRepo } from "../repo";
import { sourcingService } from "../service";
import { Actor } from "@/lib/http/route";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";
import { clearMemoryAuditChainForTesting } from "@/modules/audit";

const sourcingManagerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["SOURCING_MANAGER"],
};

const godownManagerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000002",
  type: "staff",
  roles: ["GODOWN_MANAGER"],
};

const unauthorizedStaffActor: Actor = {
  id: "01920000-0000-7000-8000-000000000003",
  type: "staff",
  roles: ["CUSTOMER_SUPPORT"],
};

describe("P13 — Sourcing Module (Suppliers, Stalls & Virtual Stock)", () => {
  beforeEach(() => {
    sourcingRepo.clearMemoryForTesting();
    clearMemoryOutboxForTesting();
    clearMemoryAuditChainForTesting();
  });

  describe("1. Supplier CRUD & Lifecycle", () => {
    it("creates a supplier with audit log and domain event", async () => {
      const supplier = await sourcingService.createSupplier(
        {
          name: "Bengal Electronics",
          proprietorName: "Abdul Karim",
          market: "NAWABPUR_COMPLEX",
          stallNo: "Shop 14, 2nd Floor",
          floor: "2",
          phone: "01711000001",
          bkashMerchantNumber: "01711000002",
          acceptedPaymentModes: ["CASH", "BKASH"],
        },
        sourcingManagerActor
      );

      expect(supplier.id).toBeDefined();
      expect(supplier.name).toBe("Bengal Electronics");
      expect(supplier.status).toBe("ACTIVE");
      expect(supplier.defectRateBp).toBe(0);
      expect(supplier.totalUnitsSourced).toBe(0);

      // Verify outbox event emitted
      const events = getMemoryOutbox();
      const createEvent = events.find((e) => e.type === "supplier.created");
      expect(createEvent).toBeDefined();
      expect(createEvent?.payload).toMatchObject({
        supplierId: supplier.id,
        name: "Bengal Electronics",
        market: "NAWABPUR_COMPLEX",
      });
    });

    it("rejects supplier creation if unauthorized staff attempts it", async () => {
      await expect(
        sourcingService.createSupplier(
          {
            name: "Bengal Electronics",
            proprietorName: "Abdul Karim",
            market: "NAWABPUR_COMPLEX",
            stallNo: "Shop 14",
            floor: "2",
            phone: "01711000001",
            acceptedPaymentModes: ["CASH"],
          },
          unauthorizedStaffActor
        )
      ).rejects.toThrow(/Insufficient permissions/);
    });

    it("allows GODOWN_MANAGER to read suppliers but not modify them", async () => {
      const supplier = await sourcingService.createSupplier(
        {
          name: "National Cables",
          proprietorName: "Rahim Mia",
          market: "PATUATULI",
          stallNo: "Shop 20",
          floor: "1",
          phone: "01811000001",
          acceptedPaymentModes: ["CASH", "SUPPLIER_CREDIT"],
        },
        sourcingManagerActor
      );

      // GODOWN_MANAGER can read
      const read = await sourcingService.getSupplierById(supplier.id, godownManagerActor);
      expect(read.id).toBe(supplier.id);

      // GODOWN_MANAGER cannot update
      await expect(
        sourcingService.updateSupplier(
          supplier.id,
          { name: "Updated Name" },
          godownManagerActor
        )
      ).rejects.toThrow(/Insufficient permissions/);
    });

    it("handles supplier suspension and reactivation with audit trail", async () => {
      const supplier = await sourcingService.createSupplier(
        {
          name: "Dhaka Power Hub",
          proprietorName: "Salim Khan",
          market: "SUNDARBAN_SQUARE",
          stallNo: "Shop 5",
          floor: "Ground",
          phone: "01911000001",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );

      // Suspend
      const suspended = await sourcingService.suspendSupplier(
        supplier.id,
        "Repeated counterfeit packaging detected",
        sourcingManagerActor
      );
      expect(suspended.status).toBe("SUSPENDED");
      expect(suspended.suspendedReason).toBe("Repeated counterfeit packaging detected");

      const suspendEvents = getMemoryOutbox().filter(
        (e) => e.type === "supplier.suspended"
      );
      expect(suspendEvents.length).toBe(1);
      expect(suspendEvents[0]?.notificationClass).toBe("A");

      // Reactivate
      const reactivated = await sourcingService.reactivateSupplier(
        supplier.id,
        sourcingManagerActor
      );
      expect(reactivated.status).toBe("ACTIVE");
      expect(reactivated.suspendedReason).toBeNull();
    });
  });

  describe("2. Batch 3-of-5 Rule (PRD §10)", () => {
    it("returns the whole batch (RETURNED) when >= 3 of 5 units fail QC", async () => {
      const supplier = await sourcingService.createSupplier(
        {
          name: "QC Test Stall",
          proprietorName: "Kamal Hossain",
          market: "STADIUM_MARKET",
          stallNo: "Shop 9",
          floor: "1",
          phone: "01611000001",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );

      // 3 of 5 fail
      const result1 = await sourcingService.recordQcOutcome(supplier.id, 2, 3);
      expect(result1.batch.outcome).toBe("RETURNED");
      expect(result1.batch.unitsTotal).toBe(5);
      expect(result1.batch.unitsFailed).toBe(3);

      // 4 of 5 fail
      const result2 = await sourcingService.recordQcOutcome(supplier.id, 1, 4);
      expect(result2.batch.outcome).toBe("RETURNED");

      // 5 of 5 fail
      const result3 = await sourcingService.recordQcOutcome(supplier.id, 0, 5);
      expect(result3.batch.outcome).toBe("RETURNED");
    });

    it("accepts the batch (ACCEPTED) when fewer than 3 of 5 units fail QC", async () => {
      const supplier = await sourcingService.createSupplier(
        {
          name: "High Quality Components",
          proprietorName: "Farid Ahmed",
          market: "NAWABPUR_COMPLEX",
          stallNo: "Shop 100",
          floor: "3",
          phone: "01711000099",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );

      // 0 of 5 fail
      const result1 = await sourcingService.recordQcOutcome(supplier.id, 5, 0);
      expect(result1.batch.outcome).toBe("ACCEPTED");

      // 1 of 5 fail
      const result2 = await sourcingService.recordQcOutcome(supplier.id, 4, 1);
      expect(result2.batch.outcome).toBe("ACCEPTED");

      // 2 of 5 fail
      const result3 = await sourcingService.recordQcOutcome(supplier.id, 3, 2);
      expect(result3.batch.outcome).toBe("ACCEPTED");
    });
  });

  describe("3. Defect Auto-Suspension Rule", () => {
    it("does NOT auto-suspend if total units sourced is less than 20, even if defect rate > 3%", async () => {
      const supplier = await sourcingService.createSupplier(
        {
          name: "Low Volume Supplier",
          proprietorName: "Anisur Rahman",
          market: "PATUATULI",
          stallNo: "Shop 44",
          floor: "1",
          phone: "01511000001",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );

      // 10 units sourced, 1 failed (10% defect rate = 1000 bp, which is > 300 bp)
      const res = await sourcingService.recordQcOutcome(supplier.id, 9, 1);
      expect(res.supplier.totalUnitsSourced).toBe(10);
      expect(res.supplier.qcFailedUnits).toBe(1);
      expect(res.supplier.defectRateBp).toBe(1000); // 10%
      expect(res.supplier.status).toBe("ACTIVE");
      expect(res.isAutoSuspended).toBe(false);
    });

    it("auto-suspends and emits Class A alert when >= 20 units sourced and defect rate > 3% (300 bp)", async () => {
      const supplier = await sourcingService.createSupplier(
        {
          name: "Defective Hardware Co",
          proprietorName: "Mizanur Rahman",
          market: "NAWABPUR_COMPLEX",
          stallNo: "Shop 77",
          floor: "Ground",
          phone: "01711223344",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );

      // Step 1: 15 units, all passed
      await sourcingService.recordQcOutcome(supplier.id, 15, 0);

      // Step 2: 5 units with 1 failure -> total 20 units, 1 failed = 5% defect rate (500 bp > 300 bp)
      const res = await sourcingService.recordQcOutcome(supplier.id, 4, 1);

      expect(res.supplier.totalUnitsSourced).toBe(20);
      expect(res.supplier.qcFailedUnits).toBe(1);
      expect(res.supplier.defectRateBp).toBe(500); // 5.00%
      expect(res.supplier.status).toBe("SUSPENDED");
      expect(res.isAutoSuspended).toBe(true);
      expect(res.supplier.suspendedReason).toContain("Defect rate (5.00%) exceeded 3% threshold");

      // Verify Class A alert emitted
      const events = getMemoryOutbox();
      const suspendEvent = events.find(
        (e) =>
          e.type === "supplier.suspended" &&
          (e.payload as Record<string, unknown>)?.autoSuspended === true
      );
      expect(suspendEvent).toBeDefined();
      expect(suspendEvent?.notificationClass).toBe("A");
    });

    it("does not auto-suspend if defect rate <= 3% (300 bp) with >= 20 units sourced", async () => {
      const supplier = await sourcingService.createSupplier(
        {
          name: "Quality Reliable Co",
          proprietorName: "Tariqul Islam",
          market: "IMPORT",
          stallNo: "Stall 12",
          floor: "2",
          phone: "01711998877",
          acceptedPaymentModes: ["SUPPLIER_CREDIT"],
        },
        sourcingManagerActor
      );

      // 100 units sourced, 2 failed (2.00% defect rate = 200 bp <= 300 bp)
      const res = await sourcingService.recordQcOutcome(supplier.id, 98, 2);
      expect(res.supplier.totalUnitsSourced).toBe(100);
      expect(res.supplier.defectRateBp).toBe(200);
      expect(res.supplier.status).toBe("ACTIVE");
      expect(res.isAutoSuspended).toBe(false);
    });
  });

  describe("4. Supplier Stock & Primary/Backup Ordering", () => {
    it("orders suppliers for a SKU by priority, active status, stock status, defect rate, and cost", async () => {
      const skuId = "01920000-1111-7000-8000-000000000001";

      // Supplier 1: Primary (priority 1), ACTIVE, AVAILABLE, defect 200 bp, cost 50000 paisa
      const sup1 = await sourcingService.createSupplier(
        {
          name: "Primary Supplier",
          proprietorName: "Alpha",
          market: "NAWABPUR_COMPLEX",
          stallNo: "S1",
          floor: "1",
          phone: "01700000001",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );
      await sourcingService.recordQcOutcome(sup1.id, 98, 2); // 200 bp

      // Supplier 2: Backup (priority 2), ACTIVE, AVAILABLE, defect 100 bp, cost 48000 paisa
      const sup2 = await sourcingService.createSupplier(
        {
          name: "Backup Supplier",
          proprietorName: "Beta",
          market: "SUNDARBAN_SQUARE",
          stallNo: "S2",
          floor: "1",
          phone: "01700000002",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );
      await sourcingService.recordQcOutcome(sup2.id, 99, 1); // 100 bp

      // Supplier 3: Primary (priority 1), SUSPENDED
      const sup3 = await sourcingService.createSupplier(
        {
          name: "Suspended Supplier",
          proprietorName: "Gamma",
          market: "PATUATULI",
          stallNo: "S3",
          floor: "1",
          phone: "01700000003",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );
      await sourcingService.suspendSupplier(sup3.id, "Violation", sourcingManagerActor);

      // Confirm stock for all 3 suppliers for skuId
      await sourcingService.updateSupplierStock(
        sup1.id,
        [
          {
            skuId,
            status: "AVAILABLE",
            priority: 1,
            lastQuotedCostPaisa: 50000,
          },
        ],
        sourcingManagerActor
      );

      await sourcingService.updateSupplierStock(
        sup2.id,
        [
          {
            skuId,
            status: "AVAILABLE",
            priority: 2,
            lastQuotedCostPaisa: 48000,
          },
        ],
        sourcingManagerActor
      );

      await sourcingService.updateSupplierStock(
        sup3.id,
        [
          {
            skuId,
            status: "AVAILABLE",
            priority: 1,
            lastQuotedCostPaisa: 45000,
          },
        ],
        sourcingManagerActor
      );

      const list = await sourcingService.getSuppliersForSku(skuId, sourcingManagerActor);
      expect(list.length).toBe(3);

      // Ordering expectations:
      // 1st: sup1 (priority 1, ACTIVE)
      // 2nd: sup3 (priority 1, but SUSPENDED)
      // 3rd: sup2 (priority 2)
      expect(list[0]?.supplier_id).toBe(sup1.id);
      expect(list[0]?.priority).toBe(1);
      expect(list[1]?.supplier_id).toBe(sup3.id);
      expect(list[2]?.supplier_id).toBe(sup2.id);
      expect(list[2]?.priority).toBe(2);
    });
  });

  describe("5. Virtual Stock Availability & Daily Cap Enforcement", () => {
    it("evaluates SKU as available when active supplier has AVAILABLE status", async () => {
      const skuId = "01920000-2222-7000-8000-000000000001";
      const sup = await sourcingService.createSupplier(
        {
          name: "Virtual Hub",
          proprietorName: "Joynal",
          market: "NAWABPUR_COMPLEX",
          stallNo: "V1",
          floor: "1",
          phone: "01700000010",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );

      await sourcingService.updateSupplierStock(
        sup.id,
        [
          {
            skuId,
            status: "AVAILABLE",
            dailyOrderCap: 50,
          },
        ],
        sourcingManagerActor
      );

      const isAvail = await sourcingService.isSkuVirtuallyAvailable(skuId);
      expect(isAvail).toBe(true);
    });

    it("enforces daily order cap when stock is LIMITED", async () => {
      const skuId = "01920000-3333-7000-8000-000000000001";
      const sup = await sourcingService.createSupplier(
        {
          name: "Capped Supplier",
          proprietorName: "Basher",
          market: "NAWABPUR_COMPLEX",
          stallNo: "C1",
          floor: "2",
          phone: "01700000011",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );

      await sourcingService.updateSupplierStock(
        sup.id,
        [
          {
            skuId,
            status: "LIMITED",
            dailyOrderCap: 5,
          },
        ],
        sourcingManagerActor
      );

      // When today's confirmed count is 4 (below cap of 5)
      sourcingRepo.setTodayVirtualOrderCountForTesting(skuId, 4);
      expect(await sourcingService.isSkuVirtuallyAvailable(skuId)).toBe(true);

      // When today's confirmed count reaches cap of 5
      sourcingRepo.setTodayVirtualOrderCountForTesting(skuId, 5);
      expect(await sourcingService.isSkuVirtuallyAvailable(skuId)).toBe(false);

      // When today's confirmed count exceeds cap
      sourcingRepo.setTodayVirtualOrderCountForTesting(skuId, 6);
      expect(await sourcingService.isSkuVirtuallyAvailable(skuId)).toBe(false);
    });

    it("evaluates SKU as unavailable if supplier is SUSPENDED or stock is OUT", async () => {
      const skuId = "01920000-4444-7000-8000-000000000001";
      const sup = await sourcingService.createSupplier(
        {
          name: "Out of Stock Hub",
          proprietorName: "Hafiz",
          market: "PATUATULI",
          stallNo: "O1",
          floor: "1",
          phone: "01700000012",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );

      await sourcingService.updateSupplierStock(
        sup.id,
        [
          {
            skuId,
            status: "OUT",
          },
        ],
        sourcingManagerActor
      );

      expect(await sourcingService.isSkuVirtuallyAvailable(skuId)).toBe(false);
    });
  });

  describe("6. Daily Stale-Status Job (08:00)", () => {
    it("identifies stock unconfirmed in last 24h as stale and emits notification event", async () => {
      const skuId = "01920000-5555-7000-8000-000000000001";
      const sup = await sourcingService.createSupplier(
        {
          name: "Stale Test Supplier",
          proprietorName: "Jashim",
          market: "STADIUM_MARKET",
          stallNo: "ST1",
          floor: "1",
          phone: "01700000013",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );

      // Upsert with confirmedAt 30 hours ago (> 24h)
      const staleTime = new Date(Date.now() - 30 * 60 * 60 * 1000);
      await sourcingRepo.upsertSupplierStock([
        {
          supplierId: sup.id,
          skuId,
          status: "AVAILABLE",
          dailyOrderCap: 10,
          lastQuotedCostPaisa: 30000,
          priority: 1,
          confirmedAt: staleTime,
          confirmedBy: sourcingManagerActor.id,
        },
      ]);

      const result = await sourcingService.markStaleSupplierStock();
      expect(result.staleCount).toBe(1);

      // Verify notification event emitted for Sourcing Manager
      const events = getMemoryOutbox();
      const staleEvent = events.find((e) => e.type === "sourcing.supplier_stock_stale");
      expect(staleEvent).toBeDefined();
      expect(staleEvent?.notificationClass).toBe("B");
      expect((staleEvent?.payload as Record<string, unknown>)?.staleCount).toBe(1);

      // Stale stock with AVAILABLE status is treated as LIMITED when checking virtual availability:
      // If cap is 10 and today has 10 orders, it will not be available
      sourcingRepo.setTodayVirtualOrderCountForTesting(skuId, 10);
      expect(await sourcingService.isSkuVirtuallyAvailable(skuId)).toBe(false);
    });
  });
});
