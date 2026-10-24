import { Actor } from "@/lib/http/route";
import { BusinessError, NotFoundError, ValidationError } from "@/lib/errors";
import { emitOutbox } from "@/lib/outbox";
import { enqueueJob } from "@/lib/queues";
import { recordAudit } from "@/modules/audit";
import { piiSerializers, CustomerRawData } from "@/modules/identity";
import { ordersService, OrderStatus } from "@/modules/orders";
import { ordersRepo } from "@/modules/orders/repo";
import { trustService } from "@/modules/trust";
import { trustRepo } from "@/modules/trust/repo";
import {
  courierEnum,
  CourierCode,
  CourierShipmentRow,
  ShipmentStatus,
} from "./schema";
import { logisticsRepo, clearMemoryLogisticsForTesting } from "./repo";
import { getCourierAdapter, MockCourierAdapter } from "./adapters";
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
} from "./dto";
import {
  assertCanViewDispatchQueue,
  assertCanPackOrder,
  assertCanBookCourier,
  assertCanHandover,
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
};
