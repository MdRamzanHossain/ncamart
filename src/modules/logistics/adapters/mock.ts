import {
  CourierAdapter,
  ShipmentInput,
  ReturnPickupInput,
  NormalizedCourierEvent,
  SettlementLineInput,
} from "./types";
import { ShipmentStatus } from "../schema";
import { UnauthenticatedError } from "@/lib/errors";

export interface MockConsignmentRecord {
  consignmentNo: string;
  orderId: string;
  orderNumber: string;
  status: ShipmentStatus;
  expectedCodPaisa: number;
  weightGrams: number;
  trackingUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory consignment store
const memConsignments = new Map<string, MockConsignmentRecord>();
let mockCounter = 1000;

export const STATUS_PROGRESSION: ShipmentStatus[] = [
  "PENDING_BOOKING",
  "BOOKED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export class MockCourierAdapter implements CourierAdapter {
  readonly code = "mock" as const;

  /**
   * Reset store for test isolation.
   */
  static clear(): void {
    memConsignments.clear();
    mockCounter = 1000;
  }

  /**
   * Get all mock consignments in memory.
   */
  static getAll(): MockConsignmentRecord[] {
    return Array.from(memConsignments.values());
  }

  /**
   * Advance status of a consignment deterministically or to explicit target status.
   */
  static advanceStatus(
    consignmentNo: string,
    targetStatus?: ShipmentStatus
  ): MockConsignmentRecord {
    const existing = memConsignments.get(consignmentNo);
    if (!existing) {
      throw new Error(`Mock consignment '${consignmentNo}' not found`);
    }

    let nextStatus: ShipmentStatus;
    if (targetStatus) {
      nextStatus = targetStatus;
    } else {
      const idx = STATUS_PROGRESSION.indexOf(existing.status);
      if (idx === -1 || idx >= STATUS_PROGRESSION.length - 1) {
        nextStatus = "DELIVERED";
      } else {
        nextStatus = STATUS_PROGRESSION[idx + 1]!;
      }
    }

    const updated: MockConsignmentRecord = {
      ...existing,
      status: nextStatus,
      updatedAt: new Date(),
    };

    memConsignments.set(consignmentNo, updated);
    return updated;
  }

  /**
   * Create deterministic consignment booking.
   */
  async createShipment(
    input: ShipmentInput
  ): Promise<{ consignmentNo: string; trackingUrl?: string }> {
    const cleanOrder = (input.orderNumber || "ORD").replace(/[^A-Za-z0-9]/g, "");
    const seq = ++mockCounter;
    const consignmentNo = `MCK-${cleanOrder}-${seq}`;
    const trackingUrl = `https://mock-courier.ncamart.internal/track/${consignmentNo}`;

    const record: MockConsignmentRecord = {
      consignmentNo,
      orderId: input.orderId,
      orderNumber: input.orderNumber || `ORD-${seq}`,
      status: "BOOKED",
      expectedCodPaisa: input.expectedCodPaisa,
      weightGrams: input.weightGrams,
      trackingUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memConsignments.set(consignmentNo, record);

    return {
      consignmentNo,
      trackingUrl,
    };
  }

  /**
   * Mock reverse pickup creation.
   */
  async createReturnPickup(
    input: ReturnPickupInput
  ): Promise<{ consignmentNo: string }> {
    const cleanOrder = (input.orderNumber || "ORD").replace(/[^A-Za-z0-9]/g, "");
    const seq = ++mockCounter;
    const consignmentNo = `MCK-RET-${cleanOrder}-${seq}`;

    const record: MockConsignmentRecord = {
      consignmentNo,
      orderId: input.orderId,
      orderNumber: input.orderNumber || `ORD-${seq}`,
      status: "BOOKED",
      expectedCodPaisa: 0,
      weightGrams: input.weightGrams,
      trackingUrl: `https://mock-courier.ncamart.internal/track/${consignmentNo}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memConsignments.set(consignmentNo, record);
    return { consignmentNo };
  }

  /**
   * Query status.
   */
  async getStatus(consignmentNo: string): Promise<NormalizedCourierEvent> {
    const record = memConsignments.get(consignmentNo);
    if (!record) {
      throw new Error(`Consignment '${consignmentNo}' not found in mock store`);
    }

    return {
      consignmentNo,
      rawStatus: record.status,
      normalizedStatus: record.status,
      occurredAt: record.updatedAt,
      payload: { ...record },
      collectedCodPaisa:
        record.status === "DELIVERED" ? record.expectedCodPaisa : null,
    };
  }

  /**
   * Simulated webhook ingestion with courier authentication.
   */
  async parseWebhook(req: Request): Promise<NormalizedCourierEvent[]> {
    // 1. Authenticate webhook request
    const secret =
      req.headers.get("x-mock-courier-secret") ||
      req.headers.get("x-mock-secret") ||
      req.headers.get("x-webhook-secret") ||
      req.headers.get("authorization");

    const expectedSecret =
      process.env.MOCK_COURIER_SECRET || "mock-courier-secret";

    if (
      req.headers.get("x-mock-force-reject-auth") === "true" ||
      (secret && secret !== expectedSecret && !secret.endsWith(expectedSecret))
    ) {
      throw new UnauthenticatedError("Invalid mock courier webhook credentials");
    }

    if (!secret && process.env.MOCK_COURIER_REQUIRE_AUTH === "true") {
      throw new UnauthenticatedError("Mock courier webhook credentials required");
    }

    const body = (await req.json()) as {
      consignment_no?: string;
      status?: ShipmentStatus;
      collected_amount_paisa?: number;
      collected_amount?: number;
      delivered_unit_ids?: string[];
      delivered_items?: Array<{ order_item_id: string; qty: number }>;
    };

    const consignmentNo = body.consignment_no;
    if (!consignmentNo) {
      return [];
    }

    const current = memConsignments.get(consignmentNo);
    const newStatus = body.status ?? (current?.status || "IN_TRANSIT");

    if (current && body.status) {
      current.status = body.status;
      current.updatedAt = new Date();
    }

    const collectedCodPaisa =
      body.collected_amount_paisa !== undefined
        ? body.collected_amount_paisa
        : body.collected_amount !== undefined
          ? Math.round(Number(body.collected_amount) * 100)
          : newStatus === "DELIVERED"
            ? (current?.expectedCodPaisa ?? null)
            : null;

    return [
      {
        consignmentNo,
        rawStatus: newStatus,
        normalizedStatus: newStatus,
        occurredAt: new Date(),
        payload: { ...body },
        collectedCodPaisa,
        dedupeKey: `mock_${consignmentNo}_${newStatus}_${Date.now()}`,
      },
    ];
  }

  /**
   * Mock settlements list.
   */
  async fetchSettlements(since: Date): Promise<SettlementLineInput[]> {
    const delivered = Array.from(memConsignments.values()).filter(
      (c) => c.status === "DELIVERED" && c.updatedAt >= since
    );

    return delivered.map((d) => ({
      consignmentNo: d.consignmentNo,
      orderNumber: d.orderNumber,
      collectedCodPaisa: d.expectedCodPaisa,
      deliveryChargePaisa: 8000,
      codChargePaisa: Math.round(d.expectedCodPaisa * 0.01),
      returnChargePaisa: 0,
      settledAt: d.updatedAt,
      rawPayload: { ...d },
    }));
  }
}
