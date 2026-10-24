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
 * Steadfast Courier Adapter
 * Implements public API integration for Steadfast Courier (Bangladesh).
 */
export class SteadfastAdapter implements CourierAdapter {
  readonly code = "steadfast" as const;

  private get baseUrl(): string {
    return process.env.STEADFAST_BASE_URL || "https://portal.steadfast.com.bd/api/v1";
  }

  private get apiKey(): string {
    return env.STEADFAST_API_KEY || process.env.STEADFAST_API_KEY || "";
  }

  private get secretKey(): string {
    return env.STEADFAST_SECRET_KEY || process.env.STEADFAST_SECRET_KEY || "";
  }

  private get headers(): Record<string, string> {
    return {
      "Api-Key": this.apiKey,
      "Secret-Key": this.secretKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Book forward parcel consignment on Steadfast.
   */
  async createShipment(
    input: ShipmentInput
  ): Promise<{ consignmentNo: string; trackingUrl?: string }> {
    const codAmount = input.expectedCodPaisa / 100;

    const payload = {
      invoice: input.orderNumber,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      recipient_address: input.recipientAddress,
      cod_amount: codAmount,
      note: input.specialInstructions || "",
    };

    try {
      const res = await fetch(`${this.baseUrl}/create_order`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `Steadfast booking failed with HTTP ${res.status}: ${errText}`
        );
      }

      const data = (await res.json()) as {
        status?: number;
        message?: string;
        consignment?: {
          consignment_id?: number | string;
          tracking_code?: string;
          status?: string;
        };
      };

      const trackingCode =
        data.consignment?.tracking_code ||
        (data.consignment?.consignment_id
          ? String(data.consignment.consignment_id)
          : undefined);

      if (!trackingCode) {
        throw new Error(
          `Steadfast response did not contain tracking code: ${JSON.stringify(data)}`
        );
      }

      return {
        consignmentNo: trackingCode,
        trackingUrl: `https://steadfast.com.bd/t/${trackingCode}`,
      };
    } catch (err) {
      logger.error({ err, orderId: input.orderId }, "Steadfast createShipment error");
      throw err;
    }
  }

  /**
   * Reverse pickup for returns/RMA.
   * TODO-VERIFY: Confirm whether Steadfast offers automated reverse-pickup via API or requires portal intake.
   */
  async createReturnPickup?(
    input: ReturnPickupInput
  ): Promise<{ consignmentNo: string }> {
    // TODO-VERIFY: Steadfast reverse pickup API endpoint schema per Phase 0 checklist
    throw new Error(
      "Steadfast reverse-pickup API endpoint is pending partner confirmation (TODO-VERIFY). Use manual dispatch console."
    );
  }

  /**
   * Query consignment status.
   */
  async getStatus(consignmentNo: string): Promise<NormalizedCourierEvent> {
    const res = await fetch(
      `${this.baseUrl}/status_by_trackingcode/${encodeURIComponent(consignmentNo)}`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Steadfast getStatus failed with HTTP ${res.status}: ${errText}`
      );
    }

    const data = (await res.json()) as {
      status?: number;
      delivery_status?: string;
    };

    const rawStatus = data.delivery_status || "unknown";
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
   * Ingest and verify webhook notification from Steadfast.
   * TODO-VERIFY: Confirm webhook HMAC signature or token verification header with Steadfast technical liaison.
   */
  async parseWebhook(req: Request): Promise<NormalizedCourierEvent[]> {
    // Verify courier auth (secret header / token)
    const secret =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("x-token") ||
      req.headers.get("authorization") ||
      "";
    const expected =
      process.env.STEADFAST_WEBHOOK_SECRET ||
      process.env.STEADFAST_SECRET_KEY ||
      env.STEADFAST_SECRET_KEY ||
      "mock_steadfast_secret";

    if (secret && secret !== expected && !secret.endsWith(expected)) {
      throw new UnauthenticatedError("Invalid Steadfast webhook credentials");
    }

    if (!secret && process.env.STEADFAST_REQUIRE_AUTH === "true") {
      throw new UnauthenticatedError("Steadfast webhook credentials required");
    }

    const body = (await req.json()) as Record<string, unknown>;
    const trackingCode = (body.tracking_code ||
      body.consignment_id ||
      body.invoice) as string | undefined;

    if (!trackingCode) {
      return [];
    }

    const rawStatus = String(body.status || body.delivery_status || "unknown");
    const normalized = this.normalizeStatus(rawStatus);

    return [
      {
        consignmentNo: trackingCode,
        rawStatus,
        normalizedStatus: normalized,
        occurredAt: new Date(),
        payload: body,
        collectedCodPaisa:
          body.cod_amount !== undefined
            ? Math.round(Number(body.cod_amount) * 100)
            : null,
        dedupeKey: `stf_${trackingCode}_${rawStatus}_${Date.now()}`,
      },
    ];
  }

  /**
   * Fetch courier settlement reports.
   * TODO-VERIFY: Format of payout statement API / CSV from Steadfast Finance portal.
   */
  async fetchSettlements?(since: Date): Promise<SettlementLineInput[]> {
    // TODO-VERIFY: Steadfast settlement statement API integration per Phase 0 checklist
    return [];
  }

  /**
   * Map raw Steadfast delivery status to NCAMart normalized courier status.
   */
  normalizeStatus(raw: string): ShipmentStatus {
    const lower = raw.toLowerCase().trim();
    switch (lower) {
      case "in_review":
      case "pending":
        return "BOOKED";
      case "picked":
      case "picked_up":
        return "PICKED_UP";
      case "in_transit":
      case "hold":
        return "IN_TRANSIT";
      case "out_for_delivery":
        return "OUT_FOR_DELIVERY";
      case "delivered":
      case "delivered_approval_pending":
        return "DELIVERED";
      case "partial_delivered":
      case "partially_delivered":
        return "PARTIALLY_DELIVERED";
      case "return_in_transit":
      case "cancelled_and_returned":
        return "RTO_IN_TRANSIT";
      case "returned":
      case "return_received":
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
