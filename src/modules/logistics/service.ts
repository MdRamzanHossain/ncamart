import { Actor } from "@/lib/http/route";
import { BusinessError, NotFoundError, ValidationError } from "@/lib/errors";
import { emitOutbox } from "@/lib/outbox";
import { enqueueJob } from "@/lib/queues";
import { recordAudit } from "@/modules/audit";
import { piiSerializers, CustomerRawData, customerService } from "@/modules/identity";
import { ordersService, OrderStatus } from "@/modules/orders";
import { ordersRepo } from "@/modules/orders/repo";
import { trustService } from "@/modules/trust";
import { trustRepo } from "@/modules/trust/repo";
import { ledgerService, postingRules } from "@/modules/ledger";
import { inventoryRepo } from "@/modules/inventory/repo";
import { logger } from "@/lib/logger";
import {
  courierEnum,
  CourierCode,
  CourierShipmentRow,
  ShipmentStatus,
} from "./schema";
import { logisticsRepo, clearMemoryLogisticsForTesting } from "./repo";
import { getCourierAdapter, MockCourierAdapter } from "./adapters";
import { NormalizedCourierEvent } from "./adapters/types";
import {
  PackOrderDto,
  packOrderSchema,
  BookConsignmentDto,
  bookConsignmentSchema,
  ManualBookingDto,
  manualBookingSchema,
  HandoverDto,
  handoverSchema,
  getNextCourierRetryDelay,
  DispatchQueueResponseDto,
  DispatchQueueItemDto,
  ManualConsoleResponseDto,
  ManualConsoleItemDto,
  ShippingLabelDto,
  STATUS_RANK,
  TERMINAL_STATUSES,
  RtoReceiveDto,
  rtoReceiveSchema,
  CodBlockOverrideDto,
  codBlockOverrideSchema,
} from "./dto";
import {
  assertCanViewDispatchQueue,
  assertCanPackOrder,
  assertCanBookCourier,
  assertCanHandover,
  assertCanReceiveRto,
  assertCanOverrideCodBlock,
} from "./policies";

export const logisticsService = {
  clearMemoryForTesting: clearMemoryLogisticsForTesting,

  // --------------------------------------------------------------------------
  // 1. Dispatch Queue (GET /api/v1/logistics/dispatch-queue)
  // --------------------------------------------------------------------------
  async getDispatchQueue(actor: Actor): Promise<DispatchQueueResponseDto> {
    assertCanViewDispatchQueue(actor);

    // 1. Find orders candidate for packaging / dispatch:
    // Candidate statuses: AT_GODOWN_QC (passed QC), CONFIRMED (physical stock / pre-QC),
    // and pre-orders ready (BALANCE_PAID, BALANCE_COD_SCHEDULED).
    const candidateStatuses: OrderStatus[] = [
      "AT_GODOWN_QC",
      "CONFIRMED",
      "BALANCE_PAID",
      "BALANCE_COD_SCHEDULED",
    ];

    const orders = await ordersRepo.listOrdersByStatuses(
      undefined,
      candidateStatuses
    );

    const result: DispatchQueueResponseDto = {
      channels: {
        COURIER: [],
        PICKUP: [],
        WALK_IN: [],
      },
      total: 0,
    };

    for (const order of orders) {
      // 2. Units verification: all units must have ACTIVE seals
      const units = await ordersRepo.listOrderItemUnitsByOrderId(
        undefined,
        order.id
      );
      if (units.length === 0) continue;

      let allUnitsActiveSealed = true;
      const unitSealIds: string[] = [];

      for (const unit of units) {
        if (!unit.sealId) {
          allUnitsActiveSealed = false;
          break;
        }
        const seal = await trustRepo.getSealRecordBySealId(unit.sealId);
        if (!seal || seal.status !== "ACTIVE") {
          allUnitsActiveSealed = false;
          break;
        }
        unitSealIds.push(unit.sealId);
      }

      if (!allUnitsActiveSealed) continue;

      // 3. Supervisor sampling check: no pending sampled audits
      const isBlocked = await trustService.isOrderPackingBlocked(order.id);
      if (isBlocked) continue;

      // 4. Serialize shipping customer PII
      const rawCustomer: CustomerRawData = {
        id: order.customerId,
        fullName: order.addressSnapshot?.name ?? "Customer",
        phone: order.addressSnapshot?.phone ?? "",
        addressLine: order.addressSnapshot?.address ?? null,
        thanaName: order.addressSnapshot?.thana ?? null,
        districtName: order.addressSnapshot?.district ?? null,
        divisionName: order.addressSnapshot?.division ?? null,
      };

      const shippingAddress = piiSerializers.toShipping(rawCustomer);

      // 5. Emit PII audit log entry: pii.read.shipping
      await recordAudit(undefined, {
        staffId: actor.id,
        actorType: "STAFF",
        action: "pii.read.shipping",
        entityType: "ORDER",
        entityId: order.id,
        afterState: {
          orderNumber: order.orderNumber,
          fulfillmentChannel: order.fulfillmentChannel,
        },
      });

      // 6. Build summary item
      const itemSummary = order.items.map((it) => ({
        sku_code: it.skuCode,
        title: it.titleEn,
        qty: it.qty,
        seals: (it.units ?? [])
          .map((u) => u.sealId)
          .filter((s): s is string => !!s),
      }));

      const queueItem: DispatchQueueItemDto = {
        order_id: order.id,
        order_number: order.orderNumber,
        fulfillment_channel: order.fulfillmentChannel,
        order_type: order.orderType,
        status: order.status,
        total_units: units.length,
        expected_cod_paisa: order.codAmountPaisa,
        placed_at: order.placedAt,
        shipping_address: shippingAddress,
        items_summary: itemSummary,
      };

      const channel = order.fulfillmentChannel as keyof typeof result.channels;
      if (result.channels[channel]) {
        result.channels[channel].push(queueItem);
      } else {
        result.channels.COURIER.push(queueItem);
      }
      result.total++;
    }

    return result;
  },

  // --------------------------------------------------------------------------
  // 2. Pack Order (POST /api/v1/logistics/orders/:orderId/pack)
  // --------------------------------------------------------------------------
  async packOrder(
    orderId: string,
    dto: PackOrderDto,
    actor: Actor
  ): Promise<{
    success: boolean;
    orderId: string;
    orderStatus: string;
    fulfillmentChannel: string;
    shipment?: CourierShipmentRow;
  }> {
    assertCanPackOrder(actor);
    const parsed = packOrderSchema.parse(dto);

    const order = await ordersRepo.getOrderWithDetails(undefined, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    if (order.status === "PACKED" || order.status === "HANDED_TO_COURIER") {
      throw new BusinessError(
        "ERR_ORDER_ALREADY_PACKED",
        `Order '${order.orderNumber}' is already packed`
      );
    }

    // 1. Verify supervisor sampling is not pending
    const isBlocked = await trustService.isOrderPackingBlocked(orderId);
    if (isBlocked) {
      throw new BusinessError(
        "ERR_QC_AUDIT_PENDING",
        "Order cannot be packed: one or more units are pending supervisor QC audit"
      );
    }

    // 2. Verify all scanned unit seal confirmations match
    const orderUnits = await ordersRepo.listOrderItemUnitsByOrderId(
      undefined,
      orderId
    );
    if (orderUnits.length === 0) {
      throw new BusinessError(
        "ERR_NO_UNITS",
        "Order has no physical units registered for packaging"
      );
    }

    const unitMap = new Map(orderUnits.map((u) => [u.id, u]));

    for (const conf of parsed.unit_seal_confirmations) {
      const unit = unitMap.get(conf.order_item_unit_id);
      if (!unit) {
        throw new BusinessError(
          "ERR_INVALID_SEAL_CONFIRMATION",
          `Unit '${conf.order_item_unit_id}' does not belong to order '${orderId}'`
        );
      }

      if (!unit.sealId || unit.sealId.toUpperCase() !== conf.seal_id.toUpperCase()) {
        throw new BusinessError(
          "ERR_INVALID_SEAL_CONFIRMATION",
          `Scanned seal '${conf.seal_id}' does not match unit seal ID '${unit.sealId}'`
        );
      }
    }

    // Ensure all units for the order are accounted for
    const confirmedUnitIds = new Set(
      parsed.unit_seal_confirmations.map((c) => c.order_item_unit_id)
    );
    for (const unit of orderUnits) {
      if (!confirmedUnitIds.has(unit.id)) {
        throw new BusinessError(
          "ERR_UNCONFIRMED_UNITS",
          `Unit '${unit.id}' (index ${unit.unitIndex}) has not been scanned/confirmed`
        );
      }
    }

    // 3. Transition order status
    if (order.fulfillmentChannel === "PICKUP") {
      // Transition AT_GODOWN_QC -> PACKED -> READY_FOR_PICKUP
      await ordersService.transitionOrder(
        undefined,
        order.id,
        "PACKED",
        actor,
        "Order packed at packaging station"
      );
      await ordersService.transitionOrder(
        undefined,
        order.id,
        "READY_FOR_PICKUP",
        actor,
        "Order staged for showroom counter pickup (P30 generates PIN)"
      );

      await emitOutbox(undefined, {
        type: "order.packed",
        aggregateType: "order",
        aggregateId: order.id,
        payload: {
          orderId: order.id,
          packageWeightGrams: parsed.package_weight_grams,
          fulfillmentChannel: "PICKUP",
        },
      });

      return {
        success: true,
        orderId: order.id,
        orderStatus: "READY_FOR_PICKUP",
        fulfillmentChannel: "PICKUP",
      };
    }

    // For COURIER fulfillment:
    await ordersService.transitionOrder(
      undefined,
      order.id,
      "PACKED",
      actor,
      "Order packed at godown packaging station"
    );

    // Determine default courier for zone
    const defaultCourier: CourierCode =
      order.deliveryZone === "INSIDE_DHAKA" ? "STEADFAST" : "STEADFAST";

    // Create courier shipment in PENDING_BOOKING
    const shipment = await logisticsRepo.createShipment({
      orderId: order.id,
      courier: defaultCourier,
      direction: "FORWARD",
      status: "PENDING_BOOKING",
      weightGrams: parsed.package_weight_grams,
      expectedCodPaisa: order.codAmountPaisa,
      bookingAttempts: 0,
    });

    // Enqueue courier booking job into queue 'courier'
    await enqueueJob("courier", "book-consignment", {
      shipmentId: shipment.id,
      attempt: 1,
    });

    // Run first booking attempt
    await this.executeBookingJob(shipment.id, 1).catch(() => {
      // Background retry loop handles failures
    });

    const refreshed = (await logisticsRepo.getShipmentById(shipment.id)) ?? shipment;

    await emitOutbox(undefined, {
      type: "order.packed",
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        packageWeightGrams: parsed.package_weight_grams,
        fulfillmentChannel: "COURIER",
        shipmentId: shipment.id,
      },
    });

    return {
      success: true,
      orderId: order.id,
      orderStatus: "PACKED",
      fulfillmentChannel: "COURIER",
      shipment: refreshed,
    };
  },

  // --------------------------------------------------------------------------
  // 3. Booking Job (Queue 'courier' with 1m, 5m, 15m, 30m Backoff)
  // --------------------------------------------------------------------------
  async executeBookingJob(
    shipmentId: string,
    attempt = 1
  ): Promise<{
    success: boolean;
    consignmentNo?: string;
    trackingUrl?: string;
    bookingFailed?: boolean;
    retryScheduled?: boolean;
    nextDelayMs?: number;
    error?: string;
  }> {
    const shipment = await logisticsRepo.getShipmentById(shipmentId);
    if (!shipment) {
      throw new NotFoundError(`Shipment '${shipmentId}' not found`);
    }

    if (shipment.status === "BOOKED" && shipment.consignmentNo) {
      return {
        success: true,
        consignmentNo: shipment.consignmentNo,
        trackingUrl: shipment.trackingUrl ?? undefined,
      };
    }

    const order = await ordersRepo.getOrderWithDetails(
      undefined,
      shipment.orderId
    );
    if (!order) {
      throw new NotFoundError(`Linked order '${shipment.orderId}' not found`);
    }

    const currentAttempt = attempt;
    const district = order.addressSnapshot?.district || "";
    const thana = order.addressSnapshot?.thana || "";

    // 1. Check mapped location IDs if required by courier (e.g. Pathao, RedX)
    let courierLocationId: string | number | null = null;
    let courierAreaId: string | number | null = null;

    if (shipment.courier === "PATHAO" || shipment.courier === "REDX") {
      const mapping = await logisticsRepo.getLocationMapping(
        shipment.courier,
        district,
        thana
      );

      if (!mapping) {
        const errorMsg = `Missing courier location mapping for courier '${shipment.courier}', district: '${district}', thana: '${thana}'`;
        await logisticsRepo.updateShipment(shipment.id, {
          status: "BOOKING_FAILED",
          lastError: errorMsg,
          bookingAttempts: currentAttempt,
        });

        await emitOutbox(undefined, {
          type: "shipment.booking_failed",
          aggregateType: "courier_shipment",
          aggregateId: shipment.id,
          payload: {
            shipmentId: shipment.id,
            orderId: order.id,
            courier: shipment.courier,
            attempts: currentAttempt,
            lastError: errorMsg,
          },
          notificationClass: "A",
        });

        return {
          success: false,
          bookingFailed: true,
          error: errorMsg,
        };
      }

      courierLocationId = mapping.cityId ?? mapping.hubId ?? null;
      courierAreaId = mapping.zoneId ?? null;
    }

    // 2. Call Courier Adapter
    try {
      const adapter = getCourierAdapter(shipment.courier);
      const bookingResult = await adapter.createShipment({
        orderId: order.id,
        orderNumber: order.orderNumber,
        recipientName: order.addressSnapshot?.name || "Customer",
        recipientPhone: order.addressSnapshot?.phone || "",
        recipientAddress: order.addressSnapshot?.address || "",
        recipientDistrict: district,
        recipientThana: thana,
        courierLocationId,
        courierAreaId,
        expectedCodPaisa: shipment.expectedCodPaisa,
        weightGrams: shipment.weightGrams,
        itemDescription: order.items.map((i) => i.titleEn).join(", "),
      });

      // Booking succeeded!
      const now = new Date();
      await logisticsRepo.updateShipment(shipment.id, {
        consignmentNo: bookingResult.consignmentNo,
        trackingUrl: bookingResult.trackingUrl ?? null,
        status: "BOOKED",
        bookedAt: now,
        bookingAttempts: currentAttempt,
        lastError: null,
      });

      // Record courier event
      await logisticsRepo.createCourierEvent({
        shipmentId: shipment.id,
        rawStatus: "BOOKED",
        normalizedStatus: "BOOKED",
        payload: {
          consignmentNo: bookingResult.consignmentNo,
          trackingUrl: bookingResult.trackingUrl,
          attempt: currentAttempt,
        },
        occurredAt: now,
        dedupeKey: `evt_book_${shipment.id}_${bookingResult.consignmentNo}`,
      });

      await emitOutbox(undefined, {
        type: "shipment.booked",
        aggregateType: "courier_shipment",
        aggregateId: shipment.id,
        payload: {
          shipmentId: shipment.id,
          orderId: order.id,
          courier: shipment.courier,
          consignmentNo: bookingResult.consignmentNo,
          trackingUrl: bookingResult.trackingUrl,
        },
      });

      return {
        success: true,
        consignmentNo: bookingResult.consignmentNo,
        trackingUrl: bookingResult.trackingUrl,
      };
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown courier booking error";

      const nextDelayMs = getNextCourierRetryDelay(currentAttempt);

      if (nextDelayMs !== null) {
        // Retry scheduled according to backoff: 1m, 5m, 15m, 30m
        await logisticsRepo.updateShipment(shipment.id, {
          bookingAttempts: currentAttempt,
          lastError: errorMsg,
        });

        await enqueueJob(
          "courier",
          "book-consignment",
          { shipmentId: shipment.id, attempt: currentAttempt + 1 },
          { delay: nextDelayMs }
        );

        return {
          success: false,
          retryScheduled: true,
          nextDelayMs,
          error: errorMsg,
        };
      }

      // Retries exhausted -> mark BOOKING_FAILED and display in manual console
      await logisticsRepo.updateShipment(shipment.id, {
        status: "BOOKING_FAILED",
        bookingAttempts: currentAttempt,
        lastError: errorMsg,
      });

      await emitOutbox(undefined, {
        type: "shipment.booking_failed",
        aggregateType: "courier_shipment",
        aggregateId: shipment.id,
        payload: {
          shipmentId: shipment.id,
          orderId: order.id,
          courier: shipment.courier,
          attempts: currentAttempt,
          lastError: errorMsg,
        },
        notificationClass: "A",
      });

      return {
        success: false,
        bookingFailed: true,
        retryScheduled: false,
        error: errorMsg,
      };
    }
  },

  // --------------------------------------------------------------------------
  // 4. Book Consignment (POST /api/v1/logistics/book-consignment — api-spec §12.2)
  // --------------------------------------------------------------------------
  async bookConsignment(
    dto: BookConsignmentDto,
    actor: Actor
  ): Promise<{
    consignment_id: string;
    tracking_code: string;
    expected_cod_paisa: number;
    shipping_label_url?: string;
  }> {
    assertCanBookCourier(actor);
    const parsed = bookConsignmentSchema.parse(dto);

    const order = await ordersRepo.getOrderWithDetails(
      undefined,
      parsed.order_id
    );
    if (!order) {
      throw new NotFoundError(`Order '${parsed.order_id}' not found`);
    }

    const courierCode = parsed.courier_partner.toUpperCase() as CourierCode;
    if (!courierEnum.includes(courierCode)) {
      throw new ValidationError(`Unsupported courier partner '${parsed.courier_partner}'`);
    }

    // Check if an existing shipment is present
    let shipment = await logisticsRepo.getShipmentByOrderId(
      parsed.order_id,
      undefined
    );

    if (shipment) {
      // Re-booking or switching courier
      shipment = await logisticsRepo.updateShipment(shipment.id, {
        courier: courierCode,
        status: "PENDING_BOOKING",
        weightGrams: parsed.package_weight_grams ?? shipment.weightGrams,
        bookingAttempts: 0,
        lastError: null,
      });
    } else {
      shipment = await logisticsRepo.createShipment({
        orderId: order.id,
        courier: courierCode,
        direction: "FORWARD",
        status: "PENDING_BOOKING",
        weightGrams: parsed.package_weight_grams ?? 500,
        expectedCodPaisa: order.codAmountPaisa,
        bookingAttempts: 0,
      });
    }

    // Execute booking immediately
    const result = await this.executeBookingJob(shipment.id, 1);
    const updated = (await logisticsRepo.getShipmentById(shipment.id)) ?? shipment;

    return {
      consignment_id: updated.id,
      tracking_code: updated.consignmentNo ?? result.consignmentNo ?? "PENDING",
      expected_cod_paisa: updated.expectedCodPaisa,
      shipping_label_url:
        updated.trackingUrl ?? `/api/v1/logistics/shipments/${updated.id}/label`,
    };
  },

  // --------------------------------------------------------------------------
  // 5. Manual Console (GET /api/v1/logistics/manual-console)
  // --------------------------------------------------------------------------
  async getManualConsole(actor: Actor): Promise<ManualConsoleResponseDto> {
    assertCanViewDispatchQueue(actor);

    // 1. Failed bookings
    const { shipments: failedList } = await logisticsRepo.listShipments({
      status: "BOOKING_FAILED",
      direction: "FORWARD",
      limit: 100,
    });

    // 2. Manual reverse pickups
    const { shipments: reverseList } = await logisticsRepo.listShipments({
      direction: "REVERSE",
      status: ["PENDING_BOOKING", "BOOKING_FAILED"],
      limit: 100,
    });

    const mapToConsoleItem = async (
      s: CourierShipmentRow
    ): Promise<ManualConsoleItemDto> => {
      const order = await ordersRepo.getOrderWithDetails(undefined, s.orderId);
      const rawCustomer: CustomerRawData = {
        id: order?.customerId ?? "unknown",
        fullName: order?.addressSnapshot?.name ?? "Customer",
        phone: order?.addressSnapshot?.phone ?? "",
        addressLine: order?.addressSnapshot?.address ?? null,
        thanaName: order?.addressSnapshot?.thana ?? null,
        districtName: order?.addressSnapshot?.district ?? null,
        divisionName: order?.addressSnapshot?.division ?? null,
      };

      const customerShipping = piiSerializers.toShipping(rawCustomer);

      await recordAudit(undefined, {
        staffId: actor.id,
        actorType: "STAFF",
        action: "pii.read.shipping",
        entityType: "SHIPMENT",
        entityId: s.id,
        afterState: { shipmentId: s.id, orderId: s.orderId },
      });

      return {
        shipment_id: s.id,
        order_id: s.orderId,
        order_number: order?.orderNumber ?? "UNKNOWN",
        courier: s.courier,
        direction: s.direction,
        status: s.status,
        weight_grams: s.weightGrams,
        expected_cod_paisa: s.expectedCodPaisa,
        booking_attempts: s.bookingAttempts,
        last_error: s.lastError,
        customer_shipping: customerShipping,
        created_at: s.createdAt,
      };
    };

    const failedItems = await Promise.all(failedList.map(mapToConsoleItem));
    const reverseItems = await Promise.all(reverseList.map(mapToConsoleItem));

    return {
      failed_bookings: failedItems,
      manual_reverse_pickups: reverseItems,
      total_actions_needed: failedItems.length + reverseItems.length,
    };
  },

  // --------------------------------------------------------------------------
  // 6. Manual Booking (POST /api/v1/logistics/shipments/:id/manual-booking)
  // --------------------------------------------------------------------------
  async manualBooking(
    shipmentId: string,
    dto: ManualBookingDto,
    actor: Actor
  ): Promise<CourierShipmentRow> {
    assertCanBookCourier(actor);
    const parsed = manualBookingSchema.parse(dto);

    const shipment = await logisticsRepo.getShipmentById(shipmentId);
    if (!shipment) {
      throw new NotFoundError(`Shipment '${shipmentId}' not found`);
    }

    const now = new Date();
    const updated = await logisticsRepo.updateShipment(shipment.id, {
      consignmentNo: parsed.consignment_no,
      trackingUrl: parsed.tracking_url ?? null,
      status: "BOOKED",
      bookedAt: now,
      lastError: null,
    });

    await logisticsRepo.createCourierEvent({
      shipmentId: shipment.id,
      rawStatus: "MANUAL_BOOKING",
      normalizedStatus: "BOOKED",
      payload: {
        consignmentNo: parsed.consignment_no,
        trackingUrl: parsed.tracking_url,
        actorId: actor.id,
      },
      occurredAt: now,
      dedupeKey: `evt_manual_${shipment.id}_${parsed.consignment_no}`,
    });

    await emitOutbox(undefined, {
      type: "shipment.booked",
      aggregateType: "courier_shipment",
      aggregateId: shipment.id,
      payload: {
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        courier: shipment.courier,
        consignmentNo: parsed.consignment_no,
        trackingUrl: parsed.tracking_url,
      },
    });

    return updated;
  },

  // --------------------------------------------------------------------------
  // 7. Courier Handover (POST /api/v1/logistics/shipments/handover)
  // --------------------------------------------------------------------------
  async handoverShipments(
    dto: HandoverDto,
    actor: Actor
  ): Promise<{ handedOverCount: number; shipmentIds: string[] }> {
    assertCanHandover(actor);
    const parsed = handoverSchema.parse(dto);

    const now = new Date();
    let handedOverCount = 0;

    for (const shipmentId of parsed.shipment_ids) {
      const shipment = await logisticsRepo.getShipmentById(shipmentId);
      if (!shipment) continue;

      // Update shipment handed_over_at and status PICKED_UP
      await logisticsRepo.updateShipment(shipment.id, {
        status: "PICKED_UP",
        handedOverAt: now,
      });

      // Transition linked order to HANDED_TO_COURIER (advance fee becomes non-refundable!)
      await ordersService.transitionOrder(
        undefined,
        shipment.orderId,
        "HANDED_TO_COURIER",
        actor,
        "Handed to courier at central godown pickup station"
      );

      // Record handover event
      await logisticsRepo.createCourierEvent({
        shipmentId: shipment.id,
        rawStatus: "HANDED_TO_COURIER",
        normalizedStatus: "PICKED_UP",
        payload: {
          consignmentNo: shipment.consignmentNo,
          handedOverAt: now.toISOString(),
          actorId: actor.id,
        },
        occurredAt: now,
        dedupeKey: `evt_handover_${shipment.id}_${now.getTime()}`,
      });

      await emitOutbox(undefined, {
        type: "shipment.handed_over",
        aggregateType: "courier_shipment",
        aggregateId: shipment.id,
        payload: {
          shipmentId: shipment.id,
          orderId: shipment.orderId,
          courier: shipment.courier,
          consignmentNo: shipment.consignmentNo,
          handedOverAt: now,
        },
      });

      handedOverCount++;
    }

    return {
      handedOverCount,
      shipmentIds: parsed.shipment_ids,
    };
  },

  // --------------------------------------------------------------------------
  // 8. Shipping Label (GET /api/v1/logistics/shipments/:id/label)
  // --------------------------------------------------------------------------
  async getShippingLabel(
    shipmentId: string,
    actor: Actor
  ): Promise<ShippingLabelDto> {
    assertCanViewDispatchQueue(actor);

    const shipment = await logisticsRepo.getShipmentById(shipmentId);
    if (!shipment) {
      throw new NotFoundError(`Shipment '${shipmentId}' not found`);
    }

    const order = await ordersRepo.getOrderWithDetails(
      undefined,
      shipment.orderId
    );
    if (!order) {
      throw new NotFoundError(`Linked order '${shipment.orderId}' not found`);
    }

    const rawCustomer: CustomerRawData = {
      id: order.customerId,
      fullName: order.addressSnapshot?.name ?? "Customer",
      phone: order.addressSnapshot?.phone ?? "",
      addressLine: order.addressSnapshot?.address ?? null,
      thanaName: order.addressSnapshot?.thana ?? null,
      districtName: order.addressSnapshot?.district ?? null,
      divisionName: order.addressSnapshot?.division ?? null,
    };

    const consignee = piiSerializers.toShipping(rawCustomer);

    await recordAudit(undefined, {
      staffId: actor.id,
      actorType: "STAFF",
      action: "pii.read.shipping",
      entityType: "SHIPMENT",
      entityId: shipment.id,
      afterState: { orderNumber: order.orderNumber },
    });

    const codBdt = (shipment.expectedCodPaisa / 100).toLocaleString("en-BD", {
      style: "currency",
      currency: "BDT",
    });

    const barcode = shipment.consignmentNo ?? order.orderNumber;

    const printableHtml = `
      <div style="font-family: sans-serif; width: 400px; padding: 16px; border: 2px solid #000;">
        <h2 style="margin: 0 0 8px 0; border-bottom: 1px solid #ccc; padding-bottom: 4px;">NCAMart Shipping Label</h2>
        <p><strong>Order No:</strong> ${order.orderNumber}</p>
        <p><strong>Courier:</strong> ${shipment.courier} | <strong>Consignment:</strong> ${barcode}</p>
        <hr style="border: 0; border-top: 1px dashed #aaa; margin: 8px 0;" />
        <p><strong>Consignee:</strong> ${consignee.consigneeName || "Customer"}</p>
        <p><strong>Contact:</strong> ${consignee.contactPhone}</p>
        <p><strong>Address:</strong> ${consignee.addressLine || ""}, ${consignee.thanaName || ""}, ${consignee.districtName || ""}</p>
        <hr style="border: 0; border-top: 1px dashed #aaa; margin: 8px 0;" />
        <p style="font-size: 1.2em;"><strong>COD Amount:</strong> ${codBdt}</p>
        <div style="text-align: center; margin-top: 16px; font-family: monospace; letter-spacing: 4px; font-size: 1.4em;">
          *${barcode}*
        </div>
      </div>
    `;

    return {
      order_number: order.orderNumber,
      consignment_no: barcode,
      courier: shipment.courier,
      consignee,
      expected_cod_paisa: shipment.expectedCodPaisa,
      expected_cod_bdt: codBdt,
      barcode_data: barcode,
      tracking_url: shipment.trackingUrl,
      printable_html: printableHtml,
    };
  },

  // --------------------------------------------------------------------------
  // 9. Dev Status Advancement (POST /api/v1/_dev/courier/:consignment/advance)
  // --------------------------------------------------------------------------
  async advanceMockConsignment(
    consignmentNo: string,
    targetStatus?: string
  ): Promise<CourierShipmentRow> {
    const updatedMock = MockCourierAdapter.advanceStatus(
      consignmentNo,
      targetStatus as ShipmentStatus | undefined
    );

    let shipment = await logisticsRepo.getShipmentByConsignmentNo(consignmentNo);
    const now = new Date();

    if (shipment) {
      const updates: Partial<CourierShipmentRow> = {
        status: updatedMock.status,
        lastEventAt: now,
      };

      if (updatedMock.status === "DELIVERED") {
        updates.deliveredAt = now;
        updates.collectedCodPaisa = shipment.expectedCodPaisa;
      } else if (updatedMock.status === "PICKED_UP") {
        updates.handedOverAt = now;
      }

      shipment = await logisticsRepo.updateShipment(shipment.id, updates);

      await logisticsRepo.createCourierEvent({
        shipmentId: shipment.id,
        rawStatus: updatedMock.status,
        normalizedStatus: updatedMock.status,
        payload: {
          consignmentNo,
          status: updatedMock.status,
          simulated: true,
        },
        occurredAt: now,
        dedupeKey: `evt_dev_${consignmentNo}_${updatedMock.status}_${now.getTime()}`,
      });
    }

    return shipment ?? (updatedMock as unknown as CourierShipmentRow);
  },

  // --------------------------------------------------------------------------
  // 10. Courier Webhook Ingestion & Event Deduplication (P29)
  // --------------------------------------------------------------------------
  async applyCourierEvent(
    event: NormalizedCourierEvent,
    courierName?: string
  ): Promise<{
    success: boolean;
    unknownConsignment?: boolean;
    deduplicated?: boolean;
    status: ShipmentStatus;
    terminal?: boolean;
    outOfOrder?: boolean;
  }> {
    const consignmentNo = event.consignmentNo;
    let shipment = await logisticsRepo.getShipmentByConsignmentNo(consignmentNo);

    if (!shipment) {
      logger.warn(
        { consignmentNo, courier: courierName, rawStatus: event.rawStatus },
        "Courier webhook received for unknown consignment"
      );
      return {
        success: true,
        unknownConsignment: true,
        status: "PENDING_BOOKING",
      };
    }

    const dedupeKey =
      event.dedupeKey ||
      `${courierName || shipment.courier}_${consignmentNo}_${event.normalizedStatus}_${event.occurredAt.getTime()}`;

    const existingEvent = await logisticsRepo.findCourierEventByDedupeKey(dedupeKey);
    if (existingEvent) {
      logger.info(
        { consignmentNo, dedupeKey, status: shipment.status },
        "Duplicate courier event ignored (idempotent)"
      );
      return {
        success: true,
        deduplicated: true,
        status: shipment.status,
      };
    }

    // Append to courier_events
    await logisticsRepo.createCourierEvent({
      shipmentId: shipment.id,
      rawStatus: event.rawStatus,
      normalizedStatus: event.normalizedStatus,
      payload: event.payload ?? {},
      occurredAt: event.occurredAt,
      dedupeKey,
    });

    // Check terminal statuses
    if (TERMINAL_STATUSES.has(shipment.status)) {
      logger.info(
        {
          shipmentId: shipment.id,
          currentStatus: shipment.status,
          eventStatus: event.normalizedStatus,
        },
        "Shipment already in terminal status, ignoring transition"
      );
      return {
        success: true,
        terminal: true,
        status: shipment.status,
      };
    }

    // Check status rank: never move backwards
    const currentRank = STATUS_RANK[shipment.status] ?? 0;
    const nextRank = STATUS_RANK[event.normalizedStatus] ?? 0;
    if (nextRank < currentRank) {
      logger.warn(
        {
          shipmentId: shipment.id,
          currentRank,
          nextRank,
          currentStatus: shipment.status,
          eventStatus: event.normalizedStatus,
        },
        "Out-of-order courier event received, ignoring backwards status transition"
      );
      return {
        success: true,
        outOfOrder: true,
        status: shipment.status,
      };
    }

    // Forward status transition
    const updates: Partial<CourierShipmentRow> = {
      status: event.normalizedStatus,
      lastEventAt: event.occurredAt,
      updatedAt: new Date(),
    };

    if (event.collectedCodPaisa !== undefined && event.collectedCodPaisa !== null) {
      updates.collectedCodPaisa = event.collectedCodPaisa;
    }
    if (event.deliveryChargePaisa !== undefined && event.deliveryChargePaisa !== null) {
      updates.deliveryChargePaisa = event.deliveryChargePaisa;
    }
    if (event.codChargePaisa !== undefined && event.codChargePaisa !== null) {
      updates.codChargePaisa = event.codChargePaisa;
    }
    if (event.returnChargePaisa !== undefined && event.returnChargePaisa !== null) {
      updates.returnChargePaisa = event.returnChargePaisa;
    }
    if (event.normalizedStatus === "DELIVERED") {
      updates.deliveredAt = event.occurredAt;
      if (updates.collectedCodPaisa === undefined || updates.collectedCodPaisa === null) {
        updates.collectedCodPaisa = shipment.expectedCodPaisa;
      }
    }

    shipment = await logisticsRepo.updateShipment(shipment.id, updates);

    // Apply domain side-effects per outcome
    if (event.normalizedStatus === "DELIVERED") {
      await this.handleDeliveredOutcome(shipment, event);
    } else if (event.normalizedStatus === "PARTIALLY_DELIVERED") {
      await this.handlePartialDeliveryOutcome(shipment, event);
    } else if (event.normalizedStatus === "RTO_IN_TRANSIT") {
      await this.handleRtoInTransitOutcome(shipment, event);
    }

    return {
      success: true,
      status: shipment.status,
    };
  },

  // --------------------------------------------------------------------------
  // 11. Delivery Outcome Handler (DELIVERED)
  // --------------------------------------------------------------------------
  async handleDeliveredOutcome(
    shipment: CourierShipmentRow,
    event: NormalizedCourierEvent
  ): Promise<void> {
    const systemActor: Actor = {
      id: "system-courier-webhook",
      type: "system",
      roles: ["SUPER_ADMIN"],
    };

    const order = await ordersRepo.getOrderWithDetails(undefined, shipment.orderId);
    if (!order) {
      logger.error({ orderId: shipment.orderId }, "Order not found for delivered shipment");
      return;
    }

    // 1. Transition order to DELIVERED
    try {
      await ordersService.transitionOrder(
        undefined as any,
        order.id,
        "DELIVERED",
        systemActor,
        `Delivered via ${shipment.courier} (consignment ${shipment.consignmentNo})`
      );
    } catch (err) {
      await ordersRepo.updateOrder(undefined, order.id, { status: "DELIVERED" });
      logger.warn(
        { err, orderId: order.id },
        "Order transition to DELIVERED handled with fallback update"
      );
    }

    // 2. Increment customer delivered order count
    await customerService.incrementDeliveredCount(order.customerId);

    // 3. Ledger revenue recognition
    const prepaidAdvancesPaisa = order.advanceFeePaid
      ? order.advanceFeePaisa
      : Math.min(order.paidAmountPaisa || 0, order.totalPaisa);
    const courierCodPaisa =
      event.collectedCodPaisa !== undefined && event.collectedCodPaisa !== null
        ? event.collectedCodPaisa
        : order.codAmountPaisa;
    const discountPaisa = order.couponDiscountPaisa || 0;
    const vatPaisa = order.taxPaisa || 0;
    const deliveryFeePaisa = order.deliveryFeePaisa || 0;
    // Cr 4000 net ex-VAT merchandise
    const revenueExVatPaisa = Math.max(0, (order.subtotalPaisa || 0) - vatPaisa);

    const revenueLines = postingRules.REVENUE_RECOGNIZED_DELIVERY({
      orderId: order.id,
      prepaidAdvancesPaisa,
      courierCodPaisa,
      courierId: shipment.courier,
      discountPaisa,
      revenueExVatPaisa,
      vatPaisa,
      deliveryFeePaisa,
    });

    await ledgerService.post(undefined, {
      eventType: "REVENUE_RECOGNIZED_DELIVERY",
      sourceType: "ORDER",
      sourceId: order.id,
      description: `Revenue recognized on delivery of order ${order.orderNumber}`,
      lines: revenueLines,
    });

    // 4. Ledger COGS recognition at unit purchase cost
    let totalCostPaisa = 0;
    for (const item of order.items) {
      totalCostPaisa += (item.unitCostPaisa || 0) * item.qty;
    }

    if (totalCostPaisa > 0) {
      const cogsLines = postingRules.COGS_RECOGNIZED({ costPaisa: totalCostPaisa });
      await ledgerService.post(undefined, {
        eventType: "COGS_RECOGNIZED",
        sourceType: "ORDER",
        sourceId: order.id,
        description: `COGS recognized for order ${order.orderNumber}`,
        lines: cogsLines,
      });
    }

    // 5. Warranty start for every unit seal
    const start = event.occurredAt;
    for (const item of order.items) {
      for (const unit of item.units) {
        if (unit.sealId) {
          const seal = await trustRepo.getSealRecordBySealId(unit.sealId);
          if (seal) {
            const end = new Date(
              start.getTime() + (seal.warrantyDays || 365) * 24 * 60 * 60 * 1000
            );
            await trustRepo.updateSealRecord(seal.id, {
              status: "ACTIVE",
              warrantyStart: start,
              warrantyEnd: end,
            });
            await trustRepo.createSealEvent({
              sealId: seal.sealId,
              fromStatus: seal.status,
              toStatus: "ACTIVE",
              actorId: "system",
              reason: `Order delivered; warranty activated starting ${start.toISOString()}`,
            });
          }
        }
      }
    }

    // 6. Issue Mushak 6.3 invoice if requested (P22)
    if (order.mushakRequested) {
      try {
        await ordersService.requestMushakInvoice(order.id, {
          companyName: order.buyerCompanyName || order.addressSnapshot?.name || "",
          bin: order.buyerBin || "",
          address: order.addressSnapshot?.address || "",
        });
      } catch (err) {
        logger.warn({ err, orderId: order.id }, "Failed to generate Mushak 6.3 on delivery");
      }
    }

    // 7. Outbox events: notification, analytics, review invitation at +3 days (P38)
    await emitOutbox(undefined, {
      type: "order.delivered",
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        customerId: order.customerId,
        deliveredAt: event.occurredAt.toISOString(),
      },
    });

    await emitOutbox(undefined, {
      type: "analytics.order_delivered",
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        customerId: order.customerId,
        totalPaisa: order.totalPaisa,
      },
    });

    const reviewInviteDate = new Date(
      event.occurredAt.getTime() + 3 * 24 * 60 * 60 * 1000
    );
    await emitOutbox(undefined, {
      type: "customer.review_invitation_due",
      aggregateType: "customer",
      aggregateId: order.customerId,
      payload: {
        orderId: order.id,
        customerId: order.customerId,
        dueAt: reviewInviteDate.toISOString(),
      },
    });
  },

  // --------------------------------------------------------------------------
  // 12. Partial Delivery Outcome Handler (PARTIALLY_DELIVERED)
  // --------------------------------------------------------------------------
  async handlePartialDeliveryOutcome(
    shipment: CourierShipmentRow,
    event: NormalizedCourierEvent
  ): Promise<void> {
    const systemActor: Actor = {
      id: "system-courier-webhook",
      type: "system",
      roles: ["SUPER_ADMIN"],
    };

    const order = await ordersRepo.getOrderWithDetails(undefined, shipment.orderId);
    if (!order) return;

    try {
      await ordersService.transitionOrder(
        undefined as any,
        order.id,
        "PARTIALLY_DELIVERED",
        systemActor,
        "Courier reported partial delivery"
      );
    } catch {
      await ordersRepo.updateOrder(undefined, order.id, { status: "PARTIALLY_DELIVERED" });
    }

    const payload = event.payload || {};
    const deliveredUnitIds: string[] = Array.isArray(payload.delivered_unit_ids)
      ? payload.delivered_unit_ids
      : [];

    let deliveredCostPaisa = 0;
    let deliveredPricePaisa = 0;

    for (const item of order.items) {
      for (const unit of item.units) {
        const isDelivered =
          deliveredUnitIds.length > 0
            ? deliveredUnitIds.includes(unit.id)
            : unit.unitIndex === 1;

        if (isDelivered) {
          deliveredCostPaisa += item.unitCostPaisa || 0;
          deliveredPricePaisa += item.unitPricePaisa || 0;

          if (unit.sealId) {
            const seal = await trustRepo.getSealRecordBySealId(unit.sealId);
            if (seal) {
              const start = event.occurredAt;
              const end = new Date(
                start.getTime() + (seal.warrantyDays || 365) * 24 * 60 * 60 * 1000
              );
              await trustRepo.updateSealRecord(seal.id, {
                status: "ACTIVE",
                warrantyStart: start,
                warrantyEnd: end,
              });
            }
          }
        } else {
          await ordersRepo.updateOrderItemUnit(undefined, unit.id, {
            status: "RETURNED_RTO",
          });
        }
      }
    }

    const courierCodPaisa = event.collectedCodPaisa ?? deliveredPricePaisa;
    const vatPaisa = Math.round((deliveredPricePaisa * 0.15) / 1.15);
    const revenueExVatPaisa = deliveredPricePaisa - vatPaisa;

    if (courierCodPaisa > 0) {
      const revenueLines = postingRules.REVENUE_RECOGNIZED_DELIVERY({
        orderId: order.id,
        prepaidAdvancesPaisa: 0,
        courierCodPaisa,
        courierId: shipment.courier,
        revenueExVatPaisa,
        vatPaisa,
      });

      await ledgerService.post(undefined, {
        eventType: "REVENUE_RECOGNIZED_PARTIAL_DELIVERY",
        sourceType: "ORDER",
        sourceId: order.id,
        description: `Revenue recognized for partial delivery of order ${order.orderNumber}`,
        lines: revenueLines,
      });
    }

    if (deliveredCostPaisa > 0) {
      const cogsLines = postingRules.COGS_RECOGNIZED({ costPaisa: deliveredCostPaisa });
      await ledgerService.post(undefined, {
        eventType: "COGS_RECOGNIZED_PARTIAL_DELIVERY",
        sourceType: "ORDER",
        sourceId: order.id,
        description: `COGS recognized for partial delivery of order ${order.orderNumber}`,
        lines: cogsLines,
      });
    }
  },

  // --------------------------------------------------------------------------
  // 13. RTO in Transit Outcome Handler (RTO_IN_TRANSIT)
  // --------------------------------------------------------------------------
  async handleRtoInTransitOutcome(
    shipment: CourierShipmentRow,
    event: NormalizedCourierEvent
  ): Promise<void> {
    const systemActor: Actor = {
      id: "system-courier-webhook",
      type: "system",
      roles: ["SUPER_ADMIN"],
    };

    const order = await ordersRepo.getOrderWithDetails(undefined, shipment.orderId);
    if (!order) return;

    try {
      await ordersService.transitionOrder(
        undefined as any,
        order.id,
        "RTO_IN_TRANSIT",
        systemActor,
        `Courier marked shipment as returning to merchant: ${shipment.courier}`
      );
    } catch {
      await ordersRepo.updateOrder(undefined, order.id, { status: "RTO_IN_TRANSIT" });
    }

    // Recompute customer's 12m RTO count and auto-block if >= 2
    await customerService.recomputeCustomerRtoCount(order.customerId);
  },

  // --------------------------------------------------------------------------
  // 14. RTO Receipt & Physical Inspection (POST /api/v1/logistics/rto/:shipmentId/receive)
  // --------------------------------------------------------------------------
  async receiveRto(
    shipmentId: string,
    input: RtoReceiveDto,
    actor: Actor
  ): Promise<{ success: boolean; shipment_status: string; claims_created: number }> {
    assertCanReceiveRto(actor);

    const validated = rtoReceiveSchema.parse(input);
    const shipment = await logisticsRepo.getShipmentById(shipmentId);
    if (!shipment) {
      throw new NotFoundError("Courier shipment");
    }

    const order = await ordersRepo.getOrderWithDetails(undefined, shipment.orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    // Transition shipment and order status
    await logisticsRepo.updateShipment(shipment.id, {
      status: "RETURNED",
      updatedAt: new Date(),
    });

    try {
      await ordersService.transitionOrder(
        undefined as any,
        order.id,
        "RETURNED",
        actor,
        "RTO shipment received and inspected at godown"
      );
    } catch {
      // Ignored if already returned
    }

    let claimsCreated = 0;
    for (const unitInspection of validated.units) {
      let unitCostPaisa = 50000;
      let skuId = "unknown";

      for (const item of order.items) {
        const foundUnit = item.units.find(
          (u) => u.id === unitInspection.order_item_unit_id
        );
        if (foundUnit) {
          unitCostPaisa = item.unitPricePaisa || item.unitCostPaisa || 50000;
          skuId = item.skuId;
          break;
        }
      }

      if (unitInspection.seal_intact) {
        // Restock to GODOWN_NAWABPUR
        await inventoryRepo.createStockMovement({
          skuId,
          fromLocationId: null,
          toLocationId: "GODOWN_NAWABPUR",
          qty: 1,
          reason: "RTO_RETURN",
          refType: "ORDER",
          refId: order.id,
          unitCostPaisa,
          staffId: actor.id,
        });
      } else {
        // Damaged: Move to DAMAGED location and create claim
        await inventoryRepo.createStockMovement({
          skuId,
          fromLocationId: null,
          toLocationId: "DAMAGED",
          qty: 1,
          reason: "DAMAGE",
          refType: "ORDER",
          refId: order.id,
          unitCostPaisa,
          staffId: actor.id,
        });

        await logisticsRepo.createCourierClaim({
          shipmentId: shipment.id,
          amountPaisa: unitCostPaisa,
          status: "PENDING",
          notes: unitInspection.notes || "Damaged upon RTO return inspection",
        });
        claimsCreated++;
      }
    }

    // Ledger RTO_ADVANCE_FEE_RETAINED (Dr 2000 / Cr 4020) if advance fee was paid
    if (order.advanceFeePaid && order.advanceFeePaisa && order.advanceFeePaisa > 0) {
      const lines = postingRules.RTO_ADVANCE_FEE_RETAINED({
        amountPaisa: order.advanceFeePaisa,
        orderId: order.id,
      });
      await ledgerService.post(undefined, {
        eventType: "RTO_ADVANCE_FEE_RETAINED",
        sourceType: "ORDER",
        sourceId: order.id,
        description: `RTO advance fee retained for order ${order.orderNumber}`,
        lines,
      });
    }

    // Refund any other prepaid amounts beyond the advance fee (P33)
    const paidAmount = order.paidAmountPaisa || 0;
    const advanceFee = order.advanceFeePaisa || 0;
    if (paidAmount > advanceFee) {
      const refundPaisa = paidAmount - advanceFee;
      await emitOutbox(undefined, {
        type: "refund.requested",
        aggregateType: "order",
        aggregateId: order.id,
        payload: {
          orderId: order.id,
          customerId: order.customerId,
          amountPaisa: refundPaisa,
          reason: "RTO_PREPAID_BALANCE_REFUND",
        },
      });
    }

    return {
      success: true,
      shipment_status: "RETURNED",
      claims_created: claimsCreated,
    };
  },

  // --------------------------------------------------------------------------
  // 15. Customer Support COD Block Override (POST /api/v1/admin/customers/:id/cod-block)
  // --------------------------------------------------------------------------
  async overrideCodBlock(
    customerId: string,
    input: CodBlockOverrideDto,
    actor: Actor
  ): Promise<{ customerId: string; codBlocked: boolean; reason: string | null }> {
    assertCanOverrideCodBlock(actor);
    const validated = codBlockOverrideSchema.parse(input);
    return customerService.overrideCodBlock(
      customerId,
      validated.blocked,
      validated.reason,
      actor
    );
  },

  // --------------------------------------------------------------------------
  // 16. Fallback Polling Job (every 30 min)
  // --------------------------------------------------------------------------
  async runCourierPollingJob(): Promise<{ polledCount: number; updatedCount: number }> {
    const stale = await logisticsRepo.listNonTerminalStaleShipments(24);
    let updatedCount = 0;

    for (const shipment of stale) {
      if (!shipment.consignmentNo) continue;
      try {
        const adapter = getCourierAdapter(shipment.courier);
        const event = await adapter.getStatus(shipment.consignmentNo);
        if (event && event.normalizedStatus !== shipment.status) {
          await this.applyCourierEvent(event, shipment.courier);
          updatedCount++;
        }
      } catch (err) {
        logger.warn(
          { err, consignmentNo: shipment.consignmentNo },
          "Error polling courier status"
        );
      }
    }

    return { polledCount: stale.length, updatedCount };
  },

  // --------------------------------------------------------------------------
  // 17. Warranty Start Fallback Job (daily at 02:00 Asia/Dhaka)
  // --------------------------------------------------------------------------
  async runWarrantyFallbackJob(): Promise<{ eligibleCount: number }> {
    const list = await logisticsRepo.listHandedOverShipmentsWithoutDelivery(3, 5);

    for (const item of list) {
      const order = await ordersRepo.getOrderWithDetails(undefined, item.shipment.orderId);
      if (!order) continue;

      for (const orderItem of order.items) {
        for (const unit of orderItem.units) {
          if (unit.sealId) {
            const seal = await trustRepo.getSealRecordBySealId(unit.sealId);
            if (seal && !seal.warrantyStart) {
              const start = item.fallbackDate;
              const end = new Date(
                start.getTime() + (seal.warrantyDays || 365) * 24 * 60 * 60 * 1000
              );
              await trustRepo.updateSealRecord(seal.id, {
                status: "ACTIVE",
                warrantyStart: start,
                warrantyEnd: end,
              });
            }
          }
        }
      }

      await recordAudit(undefined, {
        actorType: "SYSTEM",
        action: "warranty.fallback_started",
        entityType: "ORDER",
        entityId: order.id,
        afterState: {
          fallbackDate: item.fallbackDate.toISOString(),
          isInsideDhaka: item.isInsideDhaka,
        },
      });
    }

    return { eligibleCount: list.length };
  },

  // --------------------------------------------------------------------------
  // 18. Rolling 12m RTO Recompute Job (daily at 03:00 Asia/Dhaka)
  // --------------------------------------------------------------------------
  async runRtoRecomputeJob(): Promise<{ recomputedCount: number }> {
    const { shipments } = await logisticsRepo.listShipments({ limit: 1000 });
    const customerIds = new Set<string>();

    for (const s of shipments) {
      const order = await ordersRepo.getOrderWithDetails(undefined, s.orderId);
      if (order?.customerId) customerIds.add(order.customerId);
    }

    for (const customerId of customerIds) {
      await customerService.recomputeCustomerRtoCount(customerId);
    }

    return { recomputedCount: customerIds.size };
  },

  // --------------------------------------------------------------------------
  // 19. Reverse Logistics & RMA Helpers
  // --------------------------------------------------------------------------
  async bookReversePickup(input: {
    orderId: string;
    orderNumber: string;
    pickupName: string;
    pickupPhone: string;
    pickupAddress: string;
    pickupDistrict?: string | null;
    pickupThana?: string | null;
    weightGrams?: number;
    itemDescription?: string;
    reason?: string;
  }): Promise<CourierShipmentRow> {
    const adapter = getCourierAdapter("mock");
    if (!adapter.createReturnPickup) {
      throw new Error("Courier does not support reverse pickup");
    }

    const res = await adapter.createReturnPickup({
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      pickupName: input.pickupName,
      pickupPhone: input.pickupPhone,
      pickupAddress: input.pickupAddress,
      pickupDistrict: input.pickupDistrict,
      pickupThana: input.pickupThana,
      weightGrams: input.weightGrams ?? 500,
      itemDescription: input.itemDescription,
      reason: input.reason,
    });

    const shipment = await logisticsRepo.createShipment({
      orderId: input.orderId,
      courier: "MOCK",
      direction: "REVERSE",
      consignmentNo: res.consignmentNo,
      status: "BOOKED",
      weightGrams: input.weightGrams ?? 500,
      expectedCodPaisa: 0,
      bookedAt: new Date(),
    });

    return shipment;
  },

  async createManualReverseShipment(
    orderId: string,
    notes?: string
  ): Promise<CourierShipmentRow> {
    const consignmentNo = `MAN-REV-${Date.now()}`;
    return logisticsRepo.createShipment({
      orderId,
      courier: "MANUAL",
      direction: "REVERSE",
      consignmentNo,
      status: "PENDING_BOOKING",
      weightGrams: 500,
      expectedCodPaisa: 0,
    });
  },

  async createManualForwardShipment(
    orderId: string,
    notes?: string
  ): Promise<CourierShipmentRow> {
    const consignmentNo = `MAN-FWD-${Date.now()}`;
    return logisticsRepo.createShipment({
      orderId,
      courier: "MANUAL",
      direction: "FORWARD",
      consignmentNo,
      status: "BOOKED",
      weightGrams: 500,
      expectedCodPaisa: 0,
      bookedAt: new Date(),
    });
  },

  async createCourierClaim(
    data: InsertCourierClaimRow
  ): Promise<CourierClaimRow> {
    return logisticsRepo.createCourierClaim(data);
  },

  async listShipmentsByOrderId(orderId: string): Promise<CourierShipmentRow[]> {
    const { shipments } = await logisticsRepo.listShipments({ orderId, limit: 10 });
    return shipments;
  },
};
