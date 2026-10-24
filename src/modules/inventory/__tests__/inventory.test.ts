import { describe, it, expect, beforeEach } from "vitest";
import { inventoryRepo } from "../repo";
import { inventoryService } from "../service";
import { sourcingService } from "@/modules/sourcing";
import { Actor } from "@/lib/http/route";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";
import { clearMemoryAuditChainForTesting } from "@/modules/audit";

const godownManagerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["GODOWN_MANAGER"],
};

const financeOfficerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000002",
  type: "staff",
  roles: ["FINANCE_OFFICER"],
};

const sourcingManagerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000003",
  type: "staff",
  roles: ["SOURCING_MANAGER"],
};

const unauthorizedStaffActor: Actor = {
  id: "01920000-0000-7000-8000-000000000004",
  type: "staff",
  roles: ["CUSTOMER_SUPPORT"],
};

describe("P14 — Physical Inventory, Movements & Reservations", () => {
  beforeEach(() => {
    inventoryRepo.clearMemoryForTesting();
    sourcingService.clearMemoryForTesting();
    clearMemoryOutboxForTesting();
    clearMemoryAuditChainForTesting();
  });

  describe("1. Locations & Physical Stock Receiving & Transfers", () => {
    it("seeds canonical locations correctly", async () => {
      const locations = await inventoryService.listLocations();
      expect(locations.length).toBe(6);

      const codes = locations.map((l) => l.code);
      expect(codes).toContain("GODOWN_NAWABPUR");
      expect(codes).toContain("SHOWROOM_COUNTER");
      expect(codes).toContain("QC_HOLD");
      expect(codes).toContain("RMA_HOLD");
      expect(codes).toContain("DAMAGED");
      expect(codes).toContain("IN_TRANSIT");

      const godown = locations.find((l) => l.code === "GODOWN_NAWABPUR");
      expect(godown?.isSellable).toBe(true);

      const qcHold = locations.find((l) => l.code === "QC_HOLD");
      expect(qcHold?.isSellable).toBe(false);
    });

    it("receives physical stock and records append-only movement", async () => {
      const skuId = "01920000-1000-7000-8000-000000000001";
      const res = await inventoryService.receive(
        undefined,
        {
          skuId,
          locationCode: "GODOWN_NAWABPUR",
          qty: 50,
          unitCostPaisa: 120000,
          reason: "PURCHASE_RECEIPT",
          refType: "PO",
          refId: "PO-2026-001",
        },
        godownManagerActor
      );

      expect(res.balance.onHand).toBe(50);
      expect(res.balance.reserved).toBe(0);
      expect(res.movement.qty).toBe(50);
      expect(res.movement.reason).toBe("PURCHASE_RECEIPT");

      // Verify availability flipped to IN_STOCK
      const avail = await inventoryService.availability([skuId]);
      expect(avail[skuId]).toBe("IN_STOCK");

      // Verify outbox events
      const events = getMemoryOutbox();
      expect(events.some((e) => e.type === "inventory.stock_received")).toBe(true);
      expect(events.some((e) => e.type === "inventory.availability_changed")).toBe(true);
    });

    it("rejects unauthorized staff from receiving physical stock", async () => {
      const skuId = "01920000-1000-7000-8000-000000000099";
      await expect(
        inventoryService.receive(
          undefined,
          {
            skuId,
            locationCode: "GODOWN_NAWABPUR",
            qty: 10,
            unitCostPaisa: 10000,
            refId: "PO-UNAUTH",
          },
          unauthorizedStaffActor
        )
      ).rejects.toThrow(/Insufficient permissions/);
    });

    it("transfers physical stock between locations", async () => {
      const skuId = "01920000-1000-7000-8000-000000000002";
      await inventoryService.receive(
        undefined,
        {
          skuId,
          locationCode: "GODOWN_NAWABPUR",
          qty: 20,
          unitCostPaisa: 50000,
          reason: "PURCHASE_RECEIPT",
          refType: "PO",
          refId: "PO-002",
        },
        godownManagerActor
      );

      // Transfer 5 units from Godown to Showroom Counter
      const transferRes = await inventoryService.transfer(
        undefined,
        {
          skuId,
          fromLocationCode: "GODOWN_NAWABPUR",
          toLocationCode: "SHOWROOM_COUNTER",
          qty: 5,
          refType: "INTERNAL_TRANSFER",
          refId: "TR-001",
        },
        godownManagerActor
      );

      expect(transferRes.movement.qty).toBe(5);
      expect(transferRes.movement.reason).toBe("TRANSFER");

      // Check balances
      const godownLoc = await inventoryService.getLocationByCode("GODOWN_NAWABPUR");
      const showroomLoc = await inventoryService.getLocationByCode("SHOWROOM_COUNTER");

      const godownBal = await inventoryRepo.getBalance(skuId, godownLoc.id);
      const showroomBal = await inventoryRepo.getBalance(skuId, showroomLoc.id);

      expect(godownBal?.onHand).toBe(15);
      expect(showroomBal?.onHand).toBe(5);
    });

    it("prevents transfer if available quantity is insufficient", async () => {
      const skuId = "01920000-1000-7000-8000-000000000003";
      await inventoryService.receive(
        undefined,
        {
          skuId,
          locationCode: "GODOWN_NAWABPUR",
          qty: 3,
          unitCostPaisa: 10000,
          refType: "PO",
          refId: "PO-003",
        },
        godownManagerActor
      );

      await expect(
        inventoryService.transfer(
          undefined,
          {
            skuId,
            fromLocationCode: "GODOWN_NAWABPUR",
            toLocationCode: "SHOWROOM_COUNTER",
            qty: 10, // Exceeds 3
            refType: "TR",
            refId: "TR-FAIL",
          },
          godownManagerActor
        )
      ).rejects.toThrow(/Insufficient available stock/);
    });
  });

  describe("2. Concurrency: 20 Parallel reserve() Calls for Last 3 Units", () => {
    it("ensures exactly 3 calls succeed and 17 fail without negative stock", async () => {
      const skuId = "01920000-2000-7000-8000-000000000001";
      await inventoryService.receive(
        undefined,
        {
          skuId,
          locationCode: "GODOWN_NAWABPUR",
          qty: 3, // only 3 units in stock
          unitCostPaisa: 80000,
          refType: "PO",
          refId: "PO-2001",
        },
        godownManagerActor
      );

      // Launch 20 concurrent reservation attempts for 1 unit each
      const attempts = Array.from({ length: 20 }, (_, i) =>
        inventoryService.reserve(undefined, {
          orderId: `01920000-2000-7000-8000-0000000000${(i + 10).toString(16).padStart(2, "0")}`,
          skuId,
          qty: 1,
          locationPreference: ["GODOWN_NAWABPUR"],
        })
      );

      const results = await Promise.all(attempts);

      const succeeded = results.filter((r) => r !== null);
      const failed = results.filter((r) => r === null);

      expect(succeeded.length).toBe(3);
      expect(failed.length).toBe(17);

      // Verify remaining balance: on_hand = 3, reserved = 3, available = 0
      const godownLoc = await inventoryService.getLocationByCode("GODOWN_NAWABPUR");
      const balance = await inventoryRepo.getBalance(skuId, godownLoc.id);

      expect(balance?.onHand).toBe(3);
      expect(balance?.reserved).toBe(3);
      expect((balance?.onHand ?? 0) - (balance?.reserved ?? 0)).toBe(0);

      // Additional reservation must fail
      const extra = await inventoryService.reserve(undefined, {
        orderId: "01920000-2000-7000-8000-000000000099",
        skuId,
        qty: 1,
        locationPreference: ["GODOWN_NAWABPUR"],
      });
      expect(extra).toBeNull();
    });
  });

  describe("3. Commit vs Expiry Race (100 Concurrent Iterations)", () => {
    it("guarantees each reservation ends either COMMITTED or RELEASED, never both, with balance consistency", async () => {
      const skuId = "01920000-3000-7000-8000-000000000001";
      const totalUnits = 100;

      await inventoryService.receive(
        undefined,
        {
          skuId,
          locationCode: "GODOWN_NAWABPUR",
          qty: totalUnits,
          unitCostPaisa: 50000,
          refType: "PO",
          refId: "PO-3001",
        },
        godownManagerActor
      );

      // Create 100 reservations
      const reservations = [];
      for (let i = 0; i < totalUnits; i++) {
        const res = await inventoryService.reserve(undefined, {
          orderId: `01920000-3000-7000-8000-00000000${i.toString().padStart(4, "0")}`,
          skuId,
          qty: 1,
          locationPreference: ["GODOWN_NAWABPUR"],
        });
        expect(res).not.toBeNull();
        reservations.push(res!);
      }

      // Concurrently run commit and expireReservations
      const expiryDateInFuture = new Date(Date.now() + 20 * 60 * 1000);

      const racePromises = reservations.map(async (r, index) => {
        if (index % 2 === 0) {
          // Half attempt commit
          const commitSuccess = await inventoryService.commit(undefined, r.id);
          return { id: r.id, action: "commit", success: commitSuccess };
        } else {
          // Half attempt expiry
          const expiryResult = await inventoryService.expireReservations(
            expiryDateInFuture
          );
          return { id: r.id, action: "expire", success: expiryResult.expiredCount > 0 };
        }
      });

      await Promise.all(racePromises);

      // Verify every reservation state: strictly COMMITTED or RELEASED
      let committedCount = 0;
      let releasedCount = 0;

      for (const r of reservations) {
        const finalRes = await inventoryRepo.getReservationById(r.id);
        expect(finalRes).toBeDefined();
        expect(["COMMITTED", "RELEASED"]).toContain(finalRes?.status);

        if (finalRes?.status === "COMMITTED") committedCount++;
        if (finalRes?.status === "RELEASED") releasedCount++;
      }

      expect(committedCount + releasedCount).toBe(totalUnits);

      // Verify inventory balances match: on_hand = 100 - committedCount, reserved = 0
      const godownLoc = await inventoryService.getLocationByCode("GODOWN_NAWABPUR");
      const balance = await inventoryRepo.getBalance(skuId, godownLoc.id);

      expect(balance?.onHand).toBe(totalUnits - committedCount);
      expect(balance?.reserved).toBe(0);
    });
  });

  describe("4. Append-Only Movements & Nightly Integrity Check (03:30 Job)", () => {
    it("passes nightly audit when balances equal sum(movements in) - sum(movements out)", async () => {
      const skuId = "01920000-4000-7000-8000-000000000001";
      await inventoryService.receive(
        undefined,
        {
          skuId,
          locationCode: "GODOWN_NAWABPUR",
          qty: 30,
          unitCostPaisa: 60000,
          refType: "PO",
          refId: "PO-4001",
        },
        godownManagerActor
      );

      // Reserve and commit 10 units (SALE movement)
      const res = await inventoryService.reserve(undefined, {
        orderId: "01920000-4000-7000-8000-000000000010",
        skuId,
        qty: 10,
        locationPreference: ["GODOWN_NAWABPUR"],
      });
      await inventoryService.commit(undefined, res!.id);

      // Balance should be on_hand: 20
      const audit = await inventoryService.runNightlyInventoryAudit();
      expect(audit.mismatchesCount).toBe(0);
      expect(audit.mismatches.length).toBe(0);
    });

    it("catches manual balance tamper and emits Class A internal alert", async () => {
      const skuId = "01920000-4000-7000-8000-000000000002";
      await inventoryService.receive(
        undefined,
        {
          skuId,
          locationCode: "GODOWN_NAWABPUR",
          qty: 25,
          unitCostPaisa: 50000,
          refType: "PO",
          refId: "PO-4002",
        },
        godownManagerActor
      );

      const godownLoc = await inventoryService.getLocationByCode("GODOWN_NAWABPUR");

      // Simulate malicious direct DB modification (tampering with on_hand from 25 to 50 without movements)
      await inventoryRepo.upsertBalance({
        skuId,
        locationId: godownLoc.id,
        onHand: 50, // Tampered!
        reserved: 0,
        safetyStock: 0,
      });

      const audit = await inventoryService.runNightlyInventoryAudit();
      expect(audit.mismatchesCount).toBeGreaterThan(0);

      const tampered = audit.mismatches.find((m) => m.skuId === skuId);
      expect(tampered).toBeDefined();
      expect(tampered?.onHand).toBe(50);
      expect(tampered?.movementNet).toBe(25);
      expect(tampered?.discrepancy).toBe(25);

      // Verify Class A alert emitted
      const events = getMemoryOutbox();
      const alert = events.find((e) => e.type === "inventory.reconciliation_mismatch");
      expect(alert).toBeDefined();
      expect(alert?.notificationClass).toBe("A");
    });
  });

  describe("5. Allocation Rules (PRD §3.11.3)", () => {
    it("allocates courier orders to GODOWN_NAWABPUR first then SHOWROOM_COUNTER", async () => {
      const sku1 = "01920000-5000-7000-8000-000000000001"; // in godown
      const sku2 = "01920000-5000-7000-8000-000000000002"; // only in showroom

      await inventoryService.receive(
        undefined,
        {
          skuId: sku1,
          locationCode: "GODOWN_NAWABPUR",
          qty: 10,
          unitCostPaisa: 20000,
          refType: "PO",
          refId: "PO-501",
        },
        godownManagerActor
      );

      await inventoryService.receive(
        undefined,
        {
          skuId: sku2,
          locationCode: "SHOWROOM_COUNTER",
          qty: 5,
          unitCostPaisa: 25000,
          refType: "PO",
          refId: "PO-502",
        },
        godownManagerActor
      );

      const allocation = await inventoryService.allocate("REGULAR_DROP_PACK", "COURIER", [
        { skuId: sku1, qty: 2 },
        { skuId: sku2, qty: 3 },
      ]);

      expect(allocation[0]?.source).toBe("PHYSICAL");
      expect(allocation[0]?.locationCode).toBe("GODOWN_NAWABPUR");

      expect(allocation[1]?.source).toBe("PHYSICAL");
      expect(allocation[1]?.locationCode).toBe("SHOWROOM_COUNTER");
    });

    it("allocates pickup orders to SHOWROOM_COUNTER first then GODOWN_NAWABPUR", async () => {
      const sku = "01920000-5000-7000-8000-000000000003";

      // Available in both locations
      await inventoryService.receive(
        undefined,
        {
          skuId: sku,
          locationCode: "GODOWN_NAWABPUR",
          qty: 10,
          unitCostPaisa: 30000,
          refType: "PO",
          refId: "PO-503A",
        },
        godownManagerActor
      );

      await inventoryService.receive(
        undefined,
        {
          skuId: sku,
          locationCode: "SHOWROOM_COUNTER",
          qty: 10,
          unitCostPaisa: 30000,
          refType: "PO",
          refId: "PO-503B",
        },
        godownManagerActor
      );

      const allocation = await inventoryService.allocate("REGULAR_DROP_PACK", "PICKUP", [
        { skuId: sku, qty: 1 },
      ]);

      expect(allocation[0]?.source).toBe("PHYSICAL");
      expect(allocation[0]?.locationCode).toBe("SHOWROOM_COUNTER");
    });

    it("pre-order SKUs never allocate physical stock unless they are flash-deal units", async () => {
      const sku = "01920000-5000-7000-8000-000000000004";

      // Receive physical units in godown
      await inventoryService.receive(
        undefined,
        {
          skuId: sku,
          locationCode: "GODOWN_NAWABPUR",
          qty: 10,
          unitCostPaisa: 40000,
          refType: "PO",
          refId: "PO-504",
        },
        godownManagerActor
      );

      // Pre-order standard (non-flash) -> skips physical stock!
      const nonFlashAlloc = await inventoryService.allocate(
        "PRE_ORDER",
        "COURIER",
        [{ skuId: sku, qty: 1, isFlashDeal: false }]
      );
      // Because virtual stock is not configured yet for this SKU, it's UNAVAILABLE
      expect(nonFlashAlloc[0]?.source).toBe("UNAVAILABLE");

      // Pre-order flash-deal -> allowed to allocate physical stock!
      const flashAlloc = await inventoryService.allocate(
        "PRE_ORDER",
        "COURIER",
        [{ skuId: sku, qty: 1, isFlashDeal: true }]
      );
      expect(flashAlloc[0]?.source).toBe("PHYSICAL");
      expect(flashAlloc[0]?.locationCode).toBe("GODOWN_NAWABPUR");
    });

    it("falls back to virtual stock when physical stock is unavailable", async () => {
      const sku = "01920000-5000-7000-8000-000000000005";

      // No physical stock received, but active supplier has AVAILABLE stock in sourcing
      const supplier = await sourcingService.createSupplier(
        {
          name: "Virtual Supplier",
          proprietorName: "Rustom Ali",
          market: "NAWABPUR_COMPLEX",
          stallNo: "Shop 12",
          floor: "1",
          phone: "01722000001",
          acceptedPaymentModes: ["CASH"],
        },
        sourcingManagerActor
      );

      await sourcingService.updateSupplierStock(
        supplier.id,
        [{ skuId: sku, status: "AVAILABLE", priority: 1 }],
        sourcingManagerActor
      );

      const allocation = await inventoryService.allocate("REGULAR_DROP_PACK", "COURIER", [
        { skuId: sku, qty: 1 },
      ]);

      expect(allocation[0]?.source).toBe("VIRTUAL");
      expect(allocation[0]?.purchasable).toBe(true);
    });
  });

  describe("6. Stock Adjustments (Request & Approval Lifecycle)", () => {
    it("handles full lifecycle: request by GM, approval by Finance Officer, balance update", async () => {
      const skuId = "01920000-6000-7000-8000-000000000001";
      await inventoryService.receive(
        undefined,
        {
          skuId,
          locationCode: "GODOWN_NAWABPUR",
          qty: 20,
          unitCostPaisa: 15000,
          refType: "PO",
          refId: "PO-601",
        },
        godownManagerActor
      );

      // GODOWN_MANAGER requests write-off (-2 units damaged by water)
      const request = await inventoryService.requestAdjustment(
        {
          skuId,
          locationCode: "GODOWN_NAWABPUR",
          delta: -2,
          reason: "Water damage during monsoon leak",
          notes: "Bin 4B flooded",
        },
        godownManagerActor
      );

      expect(request.status).toBe("PENDING");
      expect(request.delta).toBe(-2);

      // FINANCE_OFFICER approves
      const approved = await inventoryService.approveAdjustment(
        request.id,
        { notes: "Verified write-off approved" },
        financeOfficerActor
      );

      expect(approved.status).toBe("APPROVED");
      expect(approved.approvedBy).toBe(financeOfficerActor.id);

      // Check balance: 20 - 2 = 18
      const godownLoc = await inventoryService.getLocationByCode("GODOWN_NAWABPUR");
      const balance = await inventoryRepo.getBalance(skuId, godownLoc.id);
      expect(balance?.onHand).toBe(18);

      // Check WRITE_OFF movement recorded
      const movements = await inventoryRepo.listStockMovements({ skuId });
      const writeOffMov = movements.items.find((m) => m.reason === "WRITE_OFF");
      expect(writeOffMov).toBeDefined();
      expect(writeOffMov?.qty).toBe(2);
    });
  });

  describe("7. Cycle Counts & Variance Tracking", () => {
    it("tracks variance between counted and system quantities", async () => {
      const skuId = "01920000-7000-7000-8000-000000000001";
      await inventoryService.receive(
        undefined,
        {
          skuId,
          locationCode: "GODOWN_NAWABPUR",
          qty: 15,
          unitCostPaisa: 30000,
          refType: "PO",
          refId: "PO-701",
        },
        godownManagerActor
      );

      // 1. Start cycle count
      const count = await inventoryService.startCycleCount(
        { locationCode: "GODOWN_NAWABPUR" },
        godownManagerActor
      );
      expect(count.status).toBe("IN_PROGRESS");

      // 2. Submit lines: counted 13 (variance -2)
      const lines = await inventoryService.submitCycleCountLines(
        count.id,
        { lines: [{ skuId, countedQty: 13 }] },
        godownManagerActor
      );

      expect(lines.length).toBe(1);
      expect(lines[0]?.systemQty).toBe(15);
      expect(lines[0]?.countedQty).toBe(13);
      expect(lines[0]?.variance).toBe(-2);

      // 3. Complete count
      const completed = await inventoryService.completeCycleCount(
        count.id,
        godownManagerActor
      );
      expect(completed.count.status).toBe("COMPLETED");
      expect(completed.count.completedAt).toBeDefined();
    });
  });
});
