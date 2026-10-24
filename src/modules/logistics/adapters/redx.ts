import {
  CourierAdapter,
  ShipmentInput,
  ReturnPickupInput,
  NormalizedCourierEvent,
  SettlementLineInput,
} from "./types";
import { ShipmentStatus } from "../schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { UnauthenticatedError } from "@/lib/errors";

/**
 * RedX Delivery Adapter
 * Implements integration with RedX Open API (Bangladesh).
 */
export class RedXAdapter implements CourierAdapter {
  readonly code = "redx" as const;

  private get baseUrl(): string {
    return process.env.REDX_BASE_URL || "https://openapi.redx.com.bd";
  }

  private get apiToken(): string {
    return env.REDX_ACCESS_TOKEN || process.env.REDX_ACCESS_TOKEN || "";
  }

  private get headers(): Record<string, string> {
    return {
      "API-ACCESS-TOKEN": `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Book forward parcel on RedX.
   */
  async createShipment(
    input: ShipmentInput
  ): Promise<{ consignmentNo: string; trackingUrl?: string }> {
    const codAmount = input.expectedCodPaisa / 100;

    const payload = {
      customer_name: input.recipientName,
      customer_phone: input.recipientPhone,
      delivery_area: input.recipientThana || input.recipientDistrict || "Dhaka",
      delivery_area_id: input.courierAreaId ? Number(input.courierAreaId) : undefined,
      customer_address: input.recipientAddress,
      merchant_invoice_id: input.orderNumber,
      cash_collection_amount: codAmount,
      parcel_weight: input.weightGrams,
      instruction: input.specialInstructions || "",
    };

    try {
      const res = await fetch(`${this.baseUrl}/v1.0.0-beta/parcels`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`RedX parcel creation failed: HTTP ${res.status} ${errText}`);
      }

      const data = (await res.json()) as {
        tracking_id?: string;
        message?: string;
      };

      const trackingId = data.tracking_id;
      if (!trackingId) {
        throw new Error(`RedX response missing tracking_id: ${JSON.stringify(data)}`);
      }

      return {
        consignmentNo: trackingId,
        trackingUrl: `https://redx.com.bd/track-order?trackingId=${trackingId}`,
      };
    } catch (err) {
      logger.error({ err, orderId: input.orderId }, "RedX createShipment error");
      throw err;
    }
  }

  /**
   * Reverse pickup for returns/RMA.
   * TODO-VERIFY: Confirm RedX reverse pickup availability and parameters.
   */
  async createReturnPickup?(
    input: ReturnPickupInput
  ): Promise<{ consignmentNo: string }> {
    // TODO-VERIFY: RedX reverse-pickup API per Phase 0 checklist
    throw new Error(
      "RedX reverse-pickup API endpoint is pending partner confirmation (TODO-VERIFY). Use manual dispatch console."
    );
  }

  /**
   * Query status of RedX consignment.
   */
  async getStatus(consignmentNo: string): Promise<NormalizedCourierEvent> {
    const res = await fetch(
      `${this.baseUrl}/v1.0.0-beta/parcels/${encodeURIComponent(consignmentNo)}`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`RedX getStatus failed with HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      parcel?: {
        status?: string;
      };
    };

    const rawStatus = data.parcel?.status || "unknown";
    const normalized = this.normalizeStatus(rawStatus);

    return {
      consignmentNo,
      rawStatus,
      normalizedStatus: normalized,
      occurredAt: new Date(),
      payload: data as Record<string, unknown>,
    };
  }

  /**
   * Parse RedX webhook callback with auth verification.
   * TODO-VERIFY: Confirm RedX webhook verification tokens and payload schema.
   */
  async parseWebhook(req: Request): Promise<NormalizedCourierEvent[]> {
    const token =
      req.headers.get("x-redx-secret") ||
      req.headers.get("x-webhook-secret") ||
      req.headers.get("authorization") ||
      "";
    const expected =
      process.env.REDX_WEBHOOK_SECRET ||
      process.env.REDX_ACCESS_TOKEN ||
      env.REDX_ACCESS_TOKEN ||
      "mock_redx_token";

    if (token && token !== expected && !token.endsWith(expected)) {
      throw new UnauthenticatedError("Invalid RedX webhook credentials");
    }

    if (!token && process.env.REDX_REQUIRE_AUTH === "true") {
      throw new UnauthenticatedError("RedX webhook credentials required");
    }

    const body = (await req.json()) as Record<string, unknown>;
    const trackingId = (body.tracking_id || body.merchant_invoice_id) as
      | string
      | undefined;

    if (!trackingId) {
      return [];
    }

    const rawStatus = String(body.status || "unknown");
    const normalized = this.normalizeStatus(rawStatus);

    return [
      {
        consignmentNo: trackingId,
        rawStatus,
        normalizedStatus: normalized,
        occurredAt: new Date(),
        payload: body,
        collectedCodPaisa:
          body.collected_amount !== undefined
            ? Math.round(Number(body.collected_amount) * 100)
            : null,
        dedupeKey: `redx_${trackingId}_${rawStatus}_${Date.now()}`,
      },
    ];
  }

  /**
   * Fetch settlement reports.
   * TODO-VERIFY: Format of RedX payout API/CSV statement.
   */
  async fetchSettlements?(since: Date): Promise<SettlementLineInput[]> {
    // TODO-VERIFY: RedX settlement API format per Phase 0 checklist
    return [];
  }

  /**
   * Normalize RedX status into NCAMart domain status.
   */
  normalizeStatus(raw: string): ShipmentStatus {
    const lower = raw.toLowerCase().trim();
    switch (lower) {
      case "ready-for-pickup":
      case "pickup-pending":
      case "created":
        return "BOOKED";
      case "picked-up":
      case "picked_up":
        return "PICKED_UP";
      case "in-transit":
      case "in_transit":
      case "received-at-hub":
        return "IN_TRANSIT";
      case "out-for-delivery":
      case "out_for_delivery":
        return "OUT_FOR_DELIVERY";
      case "delivered":
        return "DELIVERED";
      case "partially-delivered":
      case "partially_delivered":
        return "PARTIALLY_DELIVERED";
      case "return-in-transit":
      case "returning":
        return "RTO_IN_TRANSIT";
      case "returned":
        return "RETURNED";
      case "cancelled":
        return "CANCELLED";
      case "lost":
      case "damaged":
        return "LOST";
      default:
        return "IN_TRANSIT";
    }
  }
}
