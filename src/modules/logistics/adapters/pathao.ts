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

/**
 * Pathao Courier Adapter
 * Implements integration with Pathao Hermes API (Bangladesh).
 */
export class PathaoAdapter implements CourierAdapter {
  readonly code = "pathao" as const;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  private get baseUrl(): string {
    return process.env.PATHAO_BASE_URL || "https://api-hermes.pathao.com";
  }

  private get clientId(): string {
    return env.PATHAO_CLIENT_ID || process.env.PATHAO_CLIENT_ID || "";
  }

  private get clientSecret(): string {
    return env.PATHAO_CLIENT_SECRET || process.env.PATHAO_CLIENT_SECRET || "";
  }

  private get username(): string {
    return env.PATHAO_USERNAME || process.env.PATHAO_USERNAME || "";
  }

  private get password(): string {
    return env.PATHAO_PASSWORD || process.env.PATHAO_PASSWORD || "";
  }

  private get storeId(): string {
    return process.env.PATHAO_STORE_ID || "1";
  }

  /**
   * Acquire or refresh Pathao OAuth token.
   */
  private async getAuthToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now + 60_000) {
      return this.cachedToken;
    }

    try {
      const res = await fetch(`${this.baseUrl}/aladdin/api/v1/issue-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          username: this.username,
          password: this.password,
          grant_type: "password",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Pathao token generation failed: HTTP ${res.status} ${errText}`);
      }

      const data = (await res.json()) as {
        access_token: string;
        expires_in: number;
        token_type: string;
      };

      this.cachedToken = data.access_token;
      this.tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
      return this.cachedToken;
    } catch (err) {
      logger.error({ err }, "Failed to obtain Pathao auth token");
      throw err;
    }
  }

  /**
   * Book forward parcel on Pathao.
   */
  async createShipment(
    input: ShipmentInput
  ): Promise<{ consignmentNo: string; trackingUrl?: string }> {
    const token = await this.getAuthToken();
    const codAmount = input.expectedCodPaisa / 100;
    const weightKg = Math.max(0.5, input.weightGrams / 1000);

    const payload = {
      store_id: Number(this.storeId) || 1,
      merchant_order_id: input.orderNumber,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      recipient_address: input.recipientAddress,
      recipient_city: input.courierLocationId ? Number(input.courierLocationId) : undefined,
      recipient_zone: input.courierAreaId ? Number(input.courierAreaId) : undefined,
      delivery_type: 48, // Standard 48h
      item_type: 1, // Parcel
      special_instruction: input.specialInstructions || "",
      item_quantity: 1,
      item_weight: weightKg,
      amount_to_collect: codAmount,
      item_description: input.itemDescription || "Electronics Accessories",
    };

    try {
      const res = await fetch(`${this.baseUrl}/aladdin/api/v1/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Pathao order booking failed: HTTP ${res.status} ${errText}`);
      }

      const data = (await res.json()) as {
        type?: string;
        data?: {
          consignment_id: string;
          order_status?: string;
        };
        message?: string;
      };

      const consignmentId = data.data?.consignment_id;
      if (!consignmentId) {
        throw new Error(`Pathao response missing consignment_id: ${JSON.stringify(data)}`);
      }

      return {
        consignmentNo: consignmentId,
        trackingUrl: `https://pathao.com/courier/tracking/?consignment_id=${consignmentId}`,
      };
    } catch (err) {
      logger.error({ err, orderId: input.orderId }, "Pathao createShipment error");
      throw err;
    }
  }

  /**
   * Reverse pickup for returns/RMA.
   * TODO-VERIFY: Confirm Pathao return pickup API endpoint and merchant agreement.
   */
  async createReturnPickup?(
    input: ReturnPickupInput
  ): Promise<{ consignmentNo: string }> {
    // TODO-VERIFY: Pathao reverse pickup API endpoints per Phase 0 checklist
    throw new Error(
      "Pathao reverse-pickup API endpoint is pending partner confirmation (TODO-VERIFY). Use manual dispatch console."
    );
  }

  /**
   * Query status of Pathao consignment.
   */
  async getStatus(consignmentNo: string): Promise<NormalizedCourierEvent> {
    const token = await this.getAuthToken();
    const res = await fetch(
      `${this.baseUrl}/aladdin/api/v1/orders/${encodeURIComponent(consignmentNo)}/info`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pathao getStatus failed with HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      data?: {
        order_status?: string;
        updated_at?: string;
      };
    };

    const rawStatus = data.data?.order_status || "unknown";
    const normalized = this.normalizeStatus(rawStatus);

    return {
      consignmentNo,
      rawStatus,
      normalizedStatus: normalized,
      occurredAt: data.data?.updated_at ? new Date(data.data.updated_at) : new Date(),
      payload: data as Record<string, unknown>,
    };
  }

  /**
   * Parse Pathao webhook callback.
   * TODO-VERIFY: Verify webhook HMAC signature algorithm (X-PATHAO-Signature).
   */
  async parseWebhook(req: Request): Promise<NormalizedCourierEvent[]> {
    // TODO-VERIFY: Verify Pathao HMAC SHA256 signature header per Phase 0 checklist
    const body = (await req.json()) as Record<string, unknown>;
    const consignmentId = (body.consignment_id || body.merchant_order_id) as
      | string
      | undefined;

    if (!consignmentId) {
      return [];
    }

    const rawStatus = String(body.order_status || body.status || "unknown");
    const normalized = this.normalizeStatus(rawStatus);

    return [
      {
        consignmentNo: consignmentId,
        rawStatus,
        normalizedStatus: normalized,
        occurredAt: new Date(),
        payload: body,
        collectedCodPaisa:
          body.collected_amount !== undefined
            ? Math.round(Number(body.collected_amount) * 100)
            : null,
        dedupeKey: `pth_${consignmentId}_${rawStatus}_${Date.now()}`,
      },
    ];
  }

  /**
   * Fetch settlement data.
   * TODO-VERIFY: Pathao invoice settlement reconciliation API endpoints.
   */
  async fetchSettlements?(since: Date): Promise<SettlementLineInput[]> {
    // TODO-VERIFY: Pathao settlement reconciliation API integration per Phase 0 checklist
    return [];
  }

  /**
   * Normalize Pathao raw status into NCAMart domain status.
   */
  normalizeStatus(raw: string): ShipmentStatus {
    const lower = raw.toLowerCase().trim();
    switch (lower) {
      case "pending":
      case "confirmed":
        return "BOOKED";
      case "picked":
        return "PICKED_UP";
      case "in transit":
      case "in_transit":
        return "IN_TRANSIT";
      case "out for delivery":
      case "out_for_delivery":
        return "OUT_FOR_DELIVERY";
      case "delivered":
        return "DELIVERED";
      case "partial delivered":
      case "partial_delivered":
        return "PARTIALLY_DELIVERED";
      case "return":
      case "return in transit":
        return "RTO_IN_TRANSIT";
      case "returned":
        return "RETURNED";
      case "cancelled":
        return "CANCELLED";
      case "on hold":
      case "hold":
        return "IN_TRANSIT";
      default:
        return "IN_TRANSIT";
    }
  }
}
