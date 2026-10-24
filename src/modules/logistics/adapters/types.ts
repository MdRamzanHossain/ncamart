import { ShipmentStatus } from "../schema";

export interface ShipmentInput {
  orderId: string;
  orderNumber: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientDistrict?: string | null;
  recipientThana?: string | null;
  recipientArea?: string | null;
  courierLocationId?: string | number | null;
  courierAreaId?: string | number | null;
  expectedCodPaisa: number;
  weightGrams: number;
  itemDescription?: string;
  specialInstructions?: string;
}

export interface ReturnPickupInput {
  orderId: string;
  orderNumber: string;
  pickupName: string;
  pickupPhone: string;
  pickupAddress: string;
  pickupDistrict?: string | null;
  pickupThana?: string | null;
  courierLocationId?: string | number | null;
  courierAreaId?: string | number | null;
  weightGrams: number;
  itemDescription?: string;
  reason?: string;
}

export interface NormalizedCourierEvent {
  consignmentNo: string;
  rawStatus: string;
  normalizedStatus: ShipmentStatus;
  occurredAt: Date;
  payload: Record<string, unknown>;
  collectedCodPaisa?: number | null;
  deliveryChargePaisa?: number | null;
  codChargePaisa?: number | null;
  returnChargePaisa?: number | null;
  dedupeKey?: string;
}

export interface SettlementLineInput {
  consignmentNo: string;
  orderNumber?: string;
  collectedCodPaisa: number;
  deliveryChargePaisa: number;
  codChargePaisa: number;
  returnChargePaisa: number;
  settledAt: Date;
  rawPayload?: Record<string, unknown>;
}

/**
 * Courier adapter interface EXACTLY as architechture.md §12.
 */
export interface CourierAdapter {
  code: "steadfast" | "pathao" | "redx" | "mock" | (string & {});
  createShipment(
    input: ShipmentInput
  ): Promise<{ consignmentNo: string; trackingUrl?: string }>;
  createReturnPickup?(
    input: ReturnPickupInput
  ): Promise<{ consignmentNo: string }>; // only if the courier supports it
  getStatus(consignmentNo: string): Promise<NormalizedCourierEvent>;
  parseWebhook(req: Request): Promise<NormalizedCourierEvent[]>; // verifies courier auth first
  fetchSettlements?(since: Date): Promise<SettlementLineInput[]>;
}
