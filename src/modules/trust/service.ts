import crypto from "node:crypto";
import { Actor } from "@/lib/http/route";
import { BusinessError, NotFoundError, ValidationError } from "@/lib/errors";
import { emitOutbox } from "@/lib/outbox";
import { catalogService } from "@/modules/catalog";
import { inventoryService } from "@/modules/inventory/service";
import { ordersRepo, OrderWithDetails } from "@/modules/orders/repo";
import { sourcingRepo } from "@/modules/sourcing/repo";
import { sourcingService } from "@/modules/sourcing/service";
import { preorderService } from "@/modules/preorder/service";
import {
  trustRepo,
  clearMemoryTrustForTesting,
} from "./repo";
import {
  SealRecordRow,
  QcRecordRow,
  SealVoidRequestRow,
} from "./schema";
import {
  generateSealId,
  normalizeSealInput,
} from "./crockford";
import {
  QC_SAMPLING_BP,
  QC_AUDIT_DEADLINE_MINUTES,
  QcInspectDto,
  MintSealDto,
  ApplySealDto,
  VoidSealDto,
  ApproveVoidRequestDto,
  SupervisorAuditDto,
  validateChecklistForQcType,
  buildSealLabel,
  ResolveCloneAlertDto,
  CloneAlertDto,
  PublicVerifyResponse,
} from "./dto";
import {
  assertCanExecuteQc,
  assertCanPrintSeal,
  assertCanApproveSealVoid,
  assertCanAuditSampling,
  assertCanManageCloneAlerts,
} from "./policies";
import {
  checkVerifyRateLimit,
  resolveGeoDistrict,
  verifyTurnstileToken,
} from "./ratelimit";
import { RateLimitError } from "@/lib/errors";

export const trustService = {
  clearMemoryForTesting(): void {
    clearMemoryTrustForTesting();
  },

  // --------------------------------------------------------------------------
  // 1. QC Queue (GET /api/v1/qc/queue)
  // --------------------------------------------------------------------------
  /**
   * Retrieves units in QC_HOLD waiting for inspection:
   * - Orders in AT_GODOWN_QC
   * - Pre-orders in ARRIVED_GODOWN
   * - Returns (RTO/RMA)
   * Determines expected qc_type:
   * - Pre-orders -> FULL_PRE_DISPATCH
   * - AUTHENTIC products -> NON_INVASIVE
   * - BUDGET_SMART products -> THREE_POINT
   */
  async getQcQueue(actor: Actor): Promise<{
    queue: Array<{
      order_id: string;
      order_number: string;
      order_type: string;
      order_status: string;
      order_item_id: string;
      order_item_unit_id: string;
      unit_index: number;
      sku_id: string;
      sku_code: string;
      product_title_en: string;
      product_tier: string;
      warranty_days: number;
      expected_qc_type: "THREE_POINT" | "NON_INVASIVE" | "FULL_PRE_DISPATCH";
    }>;
  }> {
    assertCanExecuteQc(actor);

    // Orders at AT_GODOWN_QC or ARRIVED_GODOWN
    const candidateOrders: OrderWithDetails[] = await ordersRepo.findOrdersByStatuses(undefined, [
      "AT_GODOWN_QC",
      "ARRIVED_GODOWN",
    ]);

    const queue: Array<{
      order_id: string;
      order_number: string;
      order_type: string;
      order_status: string;
      order_item_id: string;
      order_item_unit_id: string;
      unit_index: number;
      sku_id: string;
      sku_code: string;
      product_title_en: string;
      product_tier: string;
      warranty_days: number;
      expected_qc_type: "THREE_POINT" | "NON_INVASIVE" | "FULL_PRE_DISPATCH";
    }> = [];

    for (const order of candidateOrders) {
      for (const item of order.items) {
        const sku = await catalogService.getSkuById(item.skuId);
        const product = sku ? await catalogService.getProductById(sku.productId) : null;
        const tier = product?.productTier ?? item.tier ?? "BUDGET_SMART";
        const warrantyDays = sku?.warrantyDays ?? 0;

        let expectedQcType: "THREE_POINT" | "NON_INVASIVE" | "FULL_PRE_DISPATCH" = "THREE_POINT";
        if (order.orderType === "PRE_ORDER" || order.status === "ARRIVED_GODOWN") {
          expectedQcType = "FULL_PRE_DISPATCH";
        } else if (tier === "AUTHENTIC") {
          expectedQcType = "NON_INVASIVE";
        } else {
          expectedQcType = "THREE_POINT";
        }

        for (const unit of item.units ?? []) {
          // If unit is not yet SEALED or DELIVERED, it's queued for QC
          if (unit.status !== "SEALED" && unit.status !== "DELIVERED" && !unit.sealId) {
            queue.push({
              order_id: order.id,
              order_number: order.orderNumber,
              order_type: order.orderType,
              order_status: order.status,
              order_item_id: item.id,
              order_item_unit_id: unit.id,
              unit_index: unit.unitIndex,
              sku_id: item.skuId,
              sku_code: item.skuCode,
              product_title_en: item.titleEn,
              product_tier: tier,
              warranty_days: warrantyDays,
              expected_qc_type: expectedQcType,
            });
          }
        }
      }
    }

    return { queue };
  },

  // --------------------------------------------------------------------------
  // 2. Submit QC Checklist (POST /api/v1/qc/inspect)
  // --------------------------------------------------------------------------
  async inspect(
    dto: QcInspectDto,
    actor: Actor
  ): Promise<{
    qc_record_id: string;
    passed: boolean;
    mint_seal_eligible: boolean;
    sampled_for_audit: boolean;
  }> {
    assertCanExecuteQc(actor);

    // 1. Validate checklist with specific Zod schema per qc_type
    const validatedChecklist = validateChecklistForQcType(dto.qc_type, dto.checklist);

    // 2. Fetch product and SKU info
    const sku = await catalogService.getSkuById(dto.sku_id);
    if (!sku) {
      throw new NotFoundError(`SKU '${dto.sku_id}' not found`);
    }
    const product = await catalogService.getProductById(sku.productId);
    const productTier = product?.productTier ?? "BUDGET_SMART";

    // 3. For AUTHENTIC tier items, OEM manufacturer serial is required
    if (productTier === "AUTHENTIC" && dto.passed) {
      if (!dto.oem_manufacturer_serial || dto.oem_manufacturer_serial.trim().length === 0) {
        throw new ValidationError("OEM manufacturer serial is required for AUTHENTIC tier items");
      }
    }

    const now = new Date();

    if (!dto.passed) {
      // ----------------------------------------------------------------------
      // FAIL PATH
      // ----------------------------------------------------------------------
      // Record failure QC record
      const qcRecord = await trustRepo.createQcRecord({
        skuId: dto.sku_id,
        orderItemUnitId: dto.order_item_unit_id ?? null,
        qcType: dto.qc_type,
        testChecklist: validatedChecklist,
        result: "FAIL",
        technicianId: actor.id,
        photos: dto.photos ?? [],
        sampledForAudit: false,
        testerNotes: dto.tester_notes ?? null,
        createdAt: now,
      });

      // Find supplier from the order's sourcing task (if available)
      let supplierId: string | null = null;
      let runnerTaskId: string | null = null;
      if (dto.order_id) {
        const { items: tasks } = await sourcingRepo.listRunnerTasks({
          orderId: dto.order_id,
          skuId: dto.sku_id,
          limit: 1,
        });
        if (tasks[0]) {
          supplierId = tasks[0].supplierId;
          runnerTaskId = tasks[0].id;
        }
      }

      if (supplierId) {
        // Record supplier QC outcome (P13 3-of-5 rule & 300 bp auto-suspension)
        await sourcingService.recordQcOutcome(supplierId, 0, 1, runnerTaskId, actor);

        // Create SUPPLIER_RETURN runner task for the defective item
        await sourcingRepo.createRunnerTask({
          taskNumber: `RET-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          taskType: "SUPPLIER_RETURN",
          orderId: dto.order_id ?? null,
          orderItemId: null,
          skuId: dto.sku_id,
          qty: 1,
          supplierId,
          maxUnitPricePaisa: sku.baseCostPaisa,
          status: "PENDING_ASSIGNMENT",
          dueAt: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4h deadline
        });

        // Create replacement SOURCING task for the order line
        if (dto.order_id) {
          await sourcingRepo.createRunnerTask({
            taskNumber: `REP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            taskType: "SOURCING",
            orderId: dto.order_id,
            skuId: dto.sku_id,
            qty: 1,
            supplierId,
            maxUnitPricePaisa: sku.baseCostPaisa,
            status: "PENDING_ASSIGNMENT",
            dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          });
        }
      }

      // Move unit to DAMAGED or PENDING
      if (dto.order_item_unit_id) {
        await ordersRepo.updateOrderItemUnit(undefined, dto.order_item_unit_id, {
          status: "PENDING",
        });
      }

      await emitOutbox(undefined, {
        type: "qc.inspection_failed",
        aggregateType: "qc_record",
        aggregateId: qcRecord.id,
        payload: {
          qcRecordId: qcRecord.id,
          skuId: dto.sku_id,
          orderId: dto.order_id,
          orderItemUnitId: dto.order_item_unit_id,
          technicianId: actor.id,
          notes: dto.tester_notes,
        },
        notificationClass: "A",
      });

      return {
        qc_record_id: qcRecord.id,
        passed: false,
        mint_seal_eligible: false,
        sampled_for_audit: false,
      };
    }

    // ------------------------------------------------------------------------
    // PASS PATH
    // ------------------------------------------------------------------------
    // 5% random sampling (crypto random < QC_SAMPLING_BP)
    const randomBp = crypto.randomInt(10000);
    const sampledForAudit = randomBp < QC_SAMPLING_BP;
    const auditDueAt = sampledForAudit
      ? new Date(now.getTime() + QC_AUDIT_DEADLINE_MINUTES * 60 * 1000)
      : null;

    const qcRecord = await trustRepo.createQcRecord({
      skuId: dto.sku_id,
      orderItemUnitId: dto.order_item_unit_id ?? null,
      qcType: dto.qc_type,
      testChecklist: validatedChecklist,
      result: "PASS",
      technicianId: actor.id,
      photos: dto.photos ?? [],
      sampledForAudit,
      auditDueAt,
      testerNotes: dto.tester_notes ?? null,
      createdAt: now,
    });

    await emitOutbox(undefined, {
      type: "qc.inspection_passed",
      aggregateType: "qc_record",
      aggregateId: qcRecord.id,
      payload: {
        qcRecordId: qcRecord.id,
        skuId: dto.sku_id,
        orderId: dto.order_id,
        orderItemUnitId: dto.order_item_unit_id,
        technicianId: actor.id,
        sampledForAudit,
        auditDueAt: auditDueAt?.toISOString() ?? null,
      },
    });

    return {
      qc_record_id: qcRecord.id,
      passed: true,
      mint_seal_eligible: true,
      sampled_for_audit: sampledForAudit,
    };
  },

  // --------------------------------------------------------------------------
  // 3. Mint & Print Crockford Base32 Seal (POST /api/v1/qc/mint-seal)
  // --------------------------------------------------------------------------
  async mintSeal(
    dto: MintSealDto,
    actor: Actor
  ): Promise<{
    seal_id: string;
    status: string;
    label: ReturnType<typeof buildSealLabel>;
    tspl_stream: string;
  }> {
    assertCanPrintSeal(actor);

    const qcRecord = await trustRepo.getQcRecordById(dto.qc_record_id);
    if (!qcRecord) {
      throw new NotFoundError(`QC record '${dto.qc_record_id}' not found`);
    }

    if (qcRecord.result !== "PASS") {
      throw new ValidationError("Cannot mint seal for non-PASS QC record");
    }

    // If seal already minted for this QC record and is still valid, return existing
    if (qcRecord.sealId) {
      const existingSeal = await trustRepo.getSealRecordBySealId(qcRecord.sealId);
      if (existingSeal && existingSeal.status !== "VOID_PRINT_ERROR") {
        const label = buildSealLabel(existingSeal.sealId, existingSeal.productTier);
        return {
          seal_id: existingSeal.sealId,
          status: existingSeal.status,
          label,
          tspl_stream: label.tspl,
        };
      }
    }

    const sku = await catalogService.getSkuById(qcRecord.skuId);
    if (!sku) {
      throw new NotFoundError(`SKU '${qcRecord.skuId}' not found`);
    }
    const product = await catalogService.getProductById(sku.productId);
    const productTier = product?.productTier ?? "BUDGET_SMART";

    // Generate Crockford Seal ID with up to 5 retries on collision
    let sealId = "";
    for (let attempt = 1; attempt <= 5; attempt++) {
      const candidate = generateSealId();
      const existing = await trustRepo.getSealRecordBySealId(candidate);
      if (!existing) {
        sealId = candidate;
        break;
      }
    }

    if (!sealId) {
      throw new BusinessError(
        "ERR_SEAL_COLLISION",
        "Failed to generate unique seal ID after 5 attempts",
        {},
        500
      );
    }

    // Extract manufacturer serial if passed in inspection
    const manufacturerSerial =
      (qcRecord.testChecklist?.oem_manufacturer_serial as string | undefined) ??
      (qcRecord.testChecklist?.manufacturer_serial as string | undefined) ??
      null;

    const seal = await trustRepo.createSealRecord({
      sealId,
      skuId: sku.id,
      productTier: productTier as "AUTHENTIC" | "BUDGET_SMART",
      orderItemUnitId: qcRecord.orderItemUnitId ?? null,
      manufacturerSerial,
      status: "GENERATED",
      technicianId: actor.id,
      warrantyDays: sku.warrantyDays ?? 0,
    });

    // Record append-only seal event
    await trustRepo.createSealEvent({
      sealId: seal.sealId,
      fromStatus: null,
      toStatus: "GENERATED",
      actorId: actor.id,
      reason: "QC Passed Seal Minted",
    });

    // Update QC record with minted seal
    await trustRepo.updateQcRecord(qcRecord.id, { sealId: seal.sealId });

    const label = buildSealLabel(seal.sealId, productTier);

    await emitOutbox(undefined, {
      type: "seal.minted",
      aggregateType: "seal",
      aggregateId: seal.id,
      payload: {
        sealId: seal.sealId,
        qcRecordId: qcRecord.id,
        skuId: sku.id,
        technicianId: actor.id,
      },
    });

    return {
      seal_id: seal.sealId,
      status: seal.status,
      label,
      tspl_stream: label.tspl,
    };
  },

  // --------------------------------------------------------------------------
  // 4. Mark Seal Printed (POST /api/v1/qc/seals/:sealId/printed)
  // --------------------------------------------------------------------------
  async markSealPrinted(
    rawSealId: string,
    actor: Actor
  ): Promise<SealRecordRow> {
    assertCanPrintSeal(actor);

    const sealId = normalizeSealInput(rawSealId);
    if (!sealId) {
      throw new ValidationError(`Invalid Seal ID format: '${rawSealId}'`);
    }

    const seal = await trustRepo.getSealRecordBySealId(sealId);
    if (!seal) {
      throw new NotFoundError(`Seal '${sealId}' not found`);
    }

    if (seal.status === "GENERATED") {
      const updated = await trustRepo.updateSealRecord(seal.id, { status: "PRINTED" });
      await trustRepo.createSealEvent({
        sealId: seal.sealId,
        fromStatus: "GENERATED",
        toStatus: "PRINTED",
        actorId: actor.id,
        reason: "Confirmed printed by client",
      });
      return updated!;
    }

    return seal;
  },

  // --------------------------------------------------------------------------
  // 5. Seal Activation: Apply to Unit (POST /api/v1/qc/seals/:sealId/apply)
  // --------------------------------------------------------------------------
  async applySeal(
    rawSealId: string,
    dto: ApplySealDto,
    actor: Actor
  ): Promise<{ seal: SealRecordRow; orderQcCompleted: boolean }> {
    assertCanExecuteQc(actor);

    const sealId = normalizeSealInput(rawSealId);
    if (!sealId) {
      throw new ValidationError(`Invalid Seal ID format: '${rawSealId}'`);
    }

    const seal = await trustRepo.getSealRecordBySealId(sealId);
    if (!seal) {
      throw new NotFoundError(`Seal '${sealId}' not found`);
    }

    // Check passing QC record exists
    const qcRecordsRes = await trustRepo.listQcRecords({
      orderItemUnitId: dto.order_item_unit_id,
      result: "PASS",
      limit: 1,
    });

    // Also check if QC record was linked directly by sealId
    const qcRecord =
      qcRecordsRes.items[0] ??
      (await trustRepo.listQcRecords({ limit: 1 })).items.find(
        (r) => r.sealId === seal.sealId && r.result === "PASS"
      );

    if (!qcRecord) {
      throw new ValidationError("Cannot activate seal: no passing QC inspection record found for this unit");
    }

    if (seal.status === "VOID_PRINT_ERROR") {
      throw new BusinessError(
        "ERR_SEAL_VOID",
        "Cannot activate a voided seal",
        {},
        400
      );
    }

    const now = new Date();
    const warrantyStart = now;
    const warrantyEnd = new Date(
      now.getTime() + (seal.warrantyDays || 365) * 24 * 60 * 60 * 1000
    );

    // Transition seal to ACTIVE
    const updatedSeal = await trustRepo.updateSealRecord(seal.id, {
      status: "ACTIVE",
      orderItemUnitId: dto.order_item_unit_id,
      warrantyStart,
      warrantyEnd,
    });

    await trustRepo.createSealEvent({
      sealId: seal.sealId,
      fromStatus: seal.status,
      toStatus: "ACTIVE",
      actorId: actor.id,
      reason: `Applied to order item unit ${dto.order_item_unit_id}`,
    });

    // Update order_item_units table: link seal_id, manufacturer_serial, status = 'SEALED'
    const unit = await ordersRepo.updateOrderItemUnit(undefined, dto.order_item_unit_id, {
      sealId: seal.sealId,
      manufacturerSerial: seal.manufacturerSerial,
      status: "SEALED",
    });

    // Move physical inventory: QC_HOLD -> GODOWN_NAWABPUR (QC_RELEASE)
    const sku = await catalogService.getSkuById(seal.skuId);
    if (sku) {
      try {
        await inventoryService.transfer(
          undefined,
          {
            skuId: sku.id,
            fromLocationCode: "QC_HOLD",
            toLocationCode: "GODOWN_NAWABPUR",
            qty: 1,
            reason: "QC_RELEASE",
            refType: "SEAL_APPLY",
            refId: seal.sealId,
          },
          undefined // system action
        );
      } catch {
        // Fallback if location not populated in isolated unit testing
      }
    }

    // Check if parent order is ready for packing
    let orderQcCompleted = false;
    if (unit) {
      // Find order item to get orderId
      const itemRow = await ordersRepo.getOrderItemById(undefined, unit.orderItemId);
      if (itemRow) {
        const orderId = itemRow.orderId;
        const allUnits = await ordersRepo.listOrderItemUnitsByOrderId(undefined, orderId);

        // Check 1: Every unit has status 'SEALED' (or has an ACTIVE seal)
        const allSealed = allUnits.length > 0 && allUnits.every((u) => u.status === "SEALED" || !!u.sealId);

        // Check 2: No pending supervisor audits for any unit of the order
        let hasPendingAudit = false;
        for (const u of allUnits) {
          const uQc = await trustRepo.getQcRecordByUnitId(u.id);
          if (uQc?.sampledForAudit && !uQc.supervisorCheckedAt) {
            hasPendingAudit = true;
            break;
          }
        }

        if (allSealed && !hasPendingAudit) {
          orderQcCompleted = true;
          const order = await ordersRepo.getOrderById(undefined, orderId);
          if (order) {
            if (order.orderType === "PRE_ORDER") {
              // Pre-orders advance to QC_VERIFIED_BALANCE_DUE
              try {
                await ordersService.transitionOrder(undefined, order.id, "QC_VERIFIED_BALANCE_DUE", actor);
              } catch {
                // If pre-order service handles state directly
              }
            }

            await emitOutbox(undefined, {
              type: "order.qc_completed",
              aggregateType: "order",
              aggregateId: order.id,
              payload: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                unitsCount: allUnits.length,
              },
            });
          }
        }
      }
    }

    return {
      seal: updatedSeal!,
      orderQcCompleted,
    };
  },

  // --------------------------------------------------------------------------
  // 6. Void Damaged Seal (POST /api/v1/qc/void-seal)
  // --------------------------------------------------------------------------
  async requestVoid(
    dto: VoidSealDto,
    actor: Actor
  ): Promise<{
    request_id: string;
    seal_id: string;
    status: string;
    voided: boolean;
    message: string;
  }> {
    assertCanExecuteQc(actor);

    const sealId = normalizeSealInput(dto.seal_id);
    if (!sealId) {
      throw new ValidationError(`Invalid Seal ID format: '${dto.seal_id}'`);
    }

    const seal = await trustRepo.getSealRecordBySealId(sealId);
    if (!seal) {
      throw new NotFoundError(`Seal '${sealId}' not found`);
    }

    if (seal.status !== "GENERATED" && seal.status !== "PRINTED") {
      throw new BusinessError(
        "ERR_SEAL_VOID_DISALLOWED",
        `Cannot void seal with status '${seal.status}'. Only GENERATED or PRINTED seals can be voided.`,
        {},
        400
      );
    }

    const request = await trustRepo.createVoidRequest({
      sealId: seal.sealId,
      reason: dto.reason,
      requestedBy: actor.id,
      status: "PENDING",
    });

    await emitOutbox(undefined, {
      type: "seal.void_requested",
      aggregateType: "seal",
      aggregateId: seal.id,
      payload: {
        requestId: request.id,
        sealId: seal.sealId,
        reason: dto.reason,
        requestedBy: actor.id,
      },
    });

    return {
      request_id: request.id,
      seal_id: seal.sealId,
      status: "PENDING",
      voided: false,
      message: "Void request created, pending manager approval",
    };
  },

  // --------------------------------------------------------------------------
  // 7. Approve Void Request & Mint Replacement (POST /api/v1/qc/void-requests/:id/approve)
  // --------------------------------------------------------------------------
  async approveVoidRequest(
    requestId: string,
    actor: Actor,
    dto?: ApproveVoidRequestDto
  ): Promise<{
    voided: boolean;
    audit_logged: boolean;
    original_seal_id: string;
    replacement_seal: {
      seal_id: string;
      status: string;
      label: ReturnType<typeof buildSealLabel>;
    };
  }> {
    assertCanApproveSealVoid(actor);

    const request = await trustRepo.getVoidRequestById(requestId);
    if (!request) {
      throw new NotFoundError(`Void request '${requestId}' not found`);
    }

    if (request.status !== "PENDING") {
      throw new BusinessError(
        "ERR_VOID_ALREADY_DECIDED",
        `Void request '${requestId}' has already been ${request.status}`,
        {},
        400
      );
    }

    const oldSeal = await trustRepo.getSealRecordBySealId(request.sealId);
    if (!oldSeal) {
      throw new NotFoundError(`Seal '${request.sealId}' not found`);
    }

    // 1. Mark old seal VOID_PRINT_ERROR
    await trustRepo.updateSealRecord(oldSeal.id, {
      status: "VOID_PRINT_ERROR",
      voidReason: request.reason,
    });

    await trustRepo.createSealEvent({
      sealId: oldSeal.sealId,
      fromStatus: oldSeal.status,
      toStatus: "VOID_PRINT_ERROR",
      actorId: actor.id,
      reason: `Void approved by manager (${request.reason}). Notes: ${dto?.notes ?? "None"}`,
    });

    // 2. Mint replacement seal with BRAND NEW ID for the SAME QC record
    let newSealId = "";
    for (let attempt = 1; attempt <= 5; attempt++) {
      const candidate = generateSealId();
      const existing = await trustRepo.getSealRecordBySealId(candidate);
      if (!existing && candidate !== oldSeal.sealId) {
        newSealId = candidate;
        break;
      }
    }

    const newSeal = await trustRepo.createSealRecord({
      sealId: newSealId,
      skuId: oldSeal.skuId,
      productTier: oldSeal.productTier,
      orderItemUnitId: oldSeal.orderItemUnitId,
      manufacturerSerial: oldSeal.manufacturerSerial,
      status: "GENERATED",
      technicianId: oldSeal.technicianId,
      warrantyDays: oldSeal.warrantyDays,
    });

    await trustRepo.createSealEvent({
      sealId: newSeal.sealId,
      fromStatus: null,
      toStatus: "GENERATED",
      actorId: actor.id,
      reason: `Replacement seal minted for voided seal ${oldSeal.sealId}`,
    });

    // Link replacedBySealId on the old seal
    await trustRepo.updateSealRecord(oldSeal.id, {
      replacedBySealId: newSeal.sealId,
    });

    // Update void request
    await trustRepo.updateVoidRequest(request.id, {
      status: "APPROVED",
      approvedBy: actor.id,
      decidedAt: new Date(),
    });

    // Update QC record to point to new seal
    const qcRecords = await trustRepo.listQcRecords({ limit: 100 });
    const qcRecord = qcRecords.items.find((r) => r.sealId === oldSeal.sealId);
    if (qcRecord) {
      await trustRepo.updateQcRecord(qcRecord.id, { sealId: newSeal.sealId });
    }

    const label = buildSealLabel(newSeal.sealId, newSeal.productTier);

    await emitOutbox(undefined, {
      type: "seal.void_approved",
      aggregateType: "seal",
      aggregateId: oldSeal.id,
      payload: {
        originalSealId: oldSeal.sealId,
        replacementSealId: newSeal.sealId,
        reason: request.reason,
        approvedBy: actor.id,
      },
    });

    return {
      voided: true,
      audit_logged: true,
      original_seal_id: oldSeal.sealId,
      replacement_seal: {
        seal_id: newSeal.sealId,
        status: newSeal.status,
        label,
      },
    };
  },

  // --------------------------------------------------------------------------
  // 8. Supervisor Sampling & Auditing
  // --------------------------------------------------------------------------
  async getSamplingQueue(actor: Actor): Promise<{ items: QcRecordRow[]; total: number }> {
    assertCanAuditSampling(actor);
    return trustRepo.listQcRecords({
      pendingSupervisorCheck: true,
      limit: 100,
    });
  },

  async supervisorAudit(
    qcRecordId: string,
    dto: SupervisorAuditDto,
    actor: Actor
  ): Promise<QcRecordRow> {
    assertCanAuditSampling(actor);

    const qcRecord = await trustRepo.getQcRecordById(qcRecordId);
    if (!qcRecord) {
      throw new NotFoundError(`QC record '${qcRecordId}' not found`);
    }

    if (!qcRecord.sampledForAudit) {
      throw new ValidationError("QC record was not sampled for supervisor audit");
    }

    const now = new Date();
    const updated = await trustRepo.updateQcRecord(qcRecord.id, {
      supervisorId: actor.id,
      supervisorResult: dto.result,
      supervisorCheckedAt: now,
      testerNotes: dto.notes
        ? `${qcRecord.testerNotes ? qcRecord.testerNotes + " | " : ""}Supervisor note: ${dto.notes}`
        : qcRecord.testerNotes,
    });

    if (dto.result === "FAIL") {
      // If seal was minted, void it
      if (qcRecord.sealId) {
        const seal = await trustRepo.getSealRecordBySealId(qcRecord.sealId);
        if (seal && seal.status !== "VOID_PRINT_ERROR") {
          await trustRepo.updateSealRecord(seal.id, {
            status: "VOID_PRINT_ERROR",
            voidReason: "STICKER_DAMAGED",
          });
          await trustRepo.createSealEvent({
            sealId: seal.sealId,
            fromStatus: seal.status,
            toStatus: "VOID_PRINT_ERROR",
            actorId: actor.id,
            reason: `Supervisor audit failed: ${dto.notes ?? "Rejected by Godown Manager"}`,
          });
        }
      }

      await emitOutbox(undefined, {
        type: "qc.supervisor_rejected",
        aggregateType: "qc_record",
        aggregateId: qcRecord.id,
        payload: {
          qcRecordId: qcRecord.id,
          supervisorId: actor.id,
          notes: dto.notes,
        },
        notificationClass: "A",
      });
    } else {
      // Supervisor PASS -> Check if order is now ready for packing
      if (qcRecord.orderItemUnitId) {
        const unit = await ordersRepo.getOrderItemUnitById(undefined, qcRecord.orderItemUnitId);
        if (unit) {
          const item = await ordersRepo.getOrderItemById(undefined, unit.orderItemId);
          if (item) {
            const blocked = await this.isOrderPackingBlocked(item.orderId);
            if (!blocked) {
              const allUnits = await ordersRepo.listOrderItemUnitsByOrderId(undefined, item.orderId);
              const allSealed = allUnits.length > 0 && allUnits.every((u) => u.status === "SEALED" || !!u.sealId);
              if (allSealed) {
                await emitOutbox(undefined, {
                  type: "order.qc_completed",
                  aggregateType: "order",
                  aggregateId: item.orderId,
                  payload: {
                    orderId: item.orderId,
                    unitsCount: allUnits.length,
                    supervisorAuditPassed: true,
                  },
                });
              }
            }
          }
        }
      }
    }

    return updated!;
  },

  /**
   * Returns true if packing for this order is blocked due to a pending sampled QC audit.
   */
  async isOrderPackingBlocked(orderId: string): Promise<boolean> {
    const units = await ordersRepo.listOrderItemUnitsByOrderId(undefined, orderId);
    for (const unit of units) {
      const qc = await trustRepo.getQcRecordByUnitId(unit.id);
      if (qc?.sampledForAudit && !qc.supervisorCheckedAt) {
        return true;
      }
    }
    return false;
  },

  /**
   * Job runs every 5 minutes:
   * Finds sampled records past audit_due_at without supervisor check -> escalate to SUPER_ADMIN once (Class A).
   */
  async runQcAuditEscalationJob(): Promise<{ escalatedCount: number }> {
    const now = new Date();
    const { items: pendingSampled } = await trustRepo.listQcRecords({
      pendingSupervisorCheck: true,
      limit: 500,
    });

    let count = 0;
    for (const record of pendingSampled) {
      if (record.auditDueAt && record.auditDueAt < now && !record.escalatedAt) {
        await trustRepo.updateQcRecord(record.id, { escalatedAt: now });
        await emitOutbox(undefined, {
          type: "qc.audit_escalated",
          aggregateType: "qc_record",
          aggregateId: record.id,
          payload: {
            qcRecordId: record.id,
            skuId: record.skuId,
            orderItemUnitId: record.orderItemUnitId,
            technicianId: record.technicianId,
            auditDueAt: record.auditDueAt.toISOString(),
            overdueMinutes: Math.floor((now.getTime() - record.auditDueAt.getTime()) / 60000),
          },
          notificationClass: "A",
        });
        count++;
      }
    }

    return { escalatedCount: count };
  },

  // --------------------------------------------------------------------------
  // 9. Customer "My Warranties" (api-spec §3.3)
  // --------------------------------------------------------------------------
  async getCustomerWarranties(customerId: string): Promise<{
    active_warranties: Array<{
      seal_id: string;
      product_title_en: string;
      product_tier: string;
      warranty_days_total: number;
      warranty_start: string | null;
      warranty_end: string | null;
      days_remaining: number;
      status: string;
    }>;
  }> {
    // 1. Fetch all delivered/delivered_counter orders belonging to this customer
    const { orders } = await ordersRepo.listCustomerOrders(undefined, customerId, {
      limit: 100,
    });

    const activeWarranties: Array<{
      seal_id: string;
      product_title_en: string;
      product_tier: string;
      warranty_days_total: number;
      warranty_start: string | null;
      warranty_end: string | null;
      days_remaining: number;
      status: string;
    }> = [];

    const now = Date.now();

    for (const order of orders) {
      // Active warranties are available for delivered orders
      for (const item of order.items) {
        for (const unit of item.units ?? []) {
          if (unit.sealId) {
            const seal = await trustRepo.getSealRecordBySealId(unit.sealId);
            if (seal && (seal.status === "ACTIVE" || seal.status === "CLAIMED")) {
              let daysRemaining = 0;
              if (seal.warrantyEnd) {
                const diffMs = seal.warrantyEnd.getTime() - now;
                daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
              }

              activeWarranties.push({
                seal_id: seal.sealId,
                product_title_en: item.titleEn,
                product_tier: seal.productTier,
                warranty_days_total: seal.warrantyDays,
                warranty_start: seal.warrantyStart?.toISOString() ?? null,
                warranty_end: seal.warrantyEnd?.toISOString() ?? null,
                days_remaining: daysRemaining,
                status: seal.status,
              });
            }
          }
        }
      }
    }

    return { active_warranties: activeWarranties };
  },

  // --------------------------------------------------------------------------
  // 11. Public Verification (GET /api/v1/verify/:sealId & GET /api/v1/verify?q=&qr=1)
  // --------------------------------------------------------------------------
  async verifyLookup(params: {
    inputQuery: string;
    deviceId: string;
    ip: string;
    userAgent: string;
    geoDistrict: string | null;
    isQr: boolean;
    turnstileToken?: string | null;
  }): Promise<
    | { success: true; notFound: false; response: PublicVerifyResponse }
    | { success: false; notFound: true; response: { is_valid: false; message: string } }
  > {
    const {
      inputQuery,
      deviceId,
      ip,
      userAgent,
      geoDistrict,
      isQr,
      turnstileToken,
    } = params;

    // 1. Enforce CGNAT-safe Rate Limits (5/min per device, 60/min per IP)
    const rateLimitRes = await checkVerifyRateLimit({
      deviceId,
      ip,
      turnstileToken,
    });

    if (rateLimitRes.blocked) {
      const err = new RateLimitError(
        rateLimitRes.retryAfterSec,
        "ERR_RATE_LIMIT_BLOCKED",
        "Access temporarily blocked due to repeated rate limit violations. Try again in 15 minutes."
      );
      (err as any).challenge = "turnstile";
      throw err;
    }

    if (!rateLimitRes.allowed && rateLimitRes.challengeRequired) {
      const err = new RateLimitError(
        rateLimitRes.retryAfterSec,
        "ERR_RATE_LIMIT_EXCEEDED",
        "Too many verification requests. Please complete Turnstile challenge."
      );
      (err as any).challenge = "turnstile";
      throw err;
    }

    // 2. Normalize input and perform lookup
    const normalized = normalizeSealInput(inputQuery);
    let seal: SealRecordRow | null = null;
    let queryType: "SEAL" | "SERIAL" = "SEAL";

    if (normalized) {
      seal = await trustRepo.getSealRecordBySealId(normalized);
    }

    if (!seal) {
      // Lookup by OEM manufacturer serial
      const trimmed = inputQuery.trim();
      if (trimmed.length > 0) {
        seal = await trustRepo.getSealRecordByManufacturerSerial(trimmed);
        if (seal) {
          queryType = "SERIAL";
        }
      }
    }

    // 3. Log lookup to seal_verifications (monthly partitioned)
    await trustRepo.createVerification({
      sealId: seal?.sealId ?? null,
      queryRaw: inputQuery,
      queryType: normalized ? "SEAL" : (queryType || "SERIAL"),
      found: !!seal,
      deviceId,
      ip,
      geoDistrict,
      userAgent,
      isQr,
    });

    // 4. Emit outbox analytics
    await emitOutbox(undefined, {
      aggregateType: "seal_verification",
      aggregateId: seal?.sealId ?? deviceId,
      type: "verify_lookup",
      payload: {
        queryRaw: inputQuery,
        sealId: seal?.sealId ?? null,
        found: !!seal,
        deviceId,
        ip,
        geoDistrict,
        isQr,
      },
    });

    if (isQr) {
      await emitOutbox(undefined, {
        aggregateType: "seal_verification",
        aggregateId: seal?.sealId ?? deviceId,
        type: "qr_scan",
        payload: {
          queryRaw: inputQuery,
          sealId: seal?.sealId ?? null,
          found: !!seal,
          deviceId,
          ip,
          geoDistrict,
        },
      });
    }

    // 5. If not found or invalid format: return 404 response
    if (!seal) {
      return {
        success: false,
        notFound: true,
        response: {
          is_valid: false,
          message: "Invalid Seal ID. Check label or enter without spaces.",
        },
      };
    }

    // 6. If seal is in VOID_PRINT_ERROR status:
    // Immediate internal alert on any lookup of a VOID_PRINT_ERROR seal
    if (seal.status === "VOID_PRINT_ERROR") {
      const recent = await trustRepo.getRecentCloneAlertBySealId(seal.sealId, 24);
      if (!recent) {
        const alert = await trustRepo.createCloneAlert({
          sealId: seal.sealId,
          reason: "VOID_SEAL_LOOKUP",
          distinctDevices: 1,
          distinctDistricts: geoDistrict ? [geoDistrict] : ["Unknown"],
          totalScans24h: 1,
          status: "OPEN",
        });

        await emitOutbox(undefined, {
          aggregateType: "security_alert",
          aggregateId: alert.id,
          type: "security.cloned_seal_suspected",
          payload: {
            alertId: alert.id,
            sealId: seal.sealId,
            reason: "VOID_SEAL_LOOKUP",
            distinctDevices: 1,
            distinctDistricts: alert.distinctDistricts,
            totalScans24h: 1,
            notificationClass: "CLASS_A",
          },
        });
      }

      return {
        success: true,
        notFound: false,
        response: {
          is_valid: false,
          seal_id: seal.sealId,
          message: "This seal is invalid (voided print error).",
        },
      };
    }

    // 7. Valid seal lookup:
    // IMPORTANT: PRD §3.2.3 wins over api-spec — the clone alert is INTERNAL ONLY.
    // The public response never reveals clone suspicion and always shows standard info.
    const sku = await catalogService.getSkuById(seal.skuId);
    const product = sku ? await catalogService.getProductById(sku.productId) : null;
    const brand = product?.brandId ? await catalogService.getBrandById(product.brandId) : null;
    const qcRecord = await trustRepo.getQcRecordBySealId(seal.sealId);

    const techCode = qcRecord
      ? `TECH-${qcRecord.technicianId.slice(-4).toUpperCase()}`
      : "TECH-01";

    let warrantyStatus = "NOT_STARTED";
    const now = new Date();
    if (seal.status === "CLAIMED") {
      warrantyStatus = "CLAIMED";
    } else if (seal.status === "EXPIRED" || (seal.warrantyEnd && seal.warrantyEnd < now)) {
      warrantyStatus = "EXPIRED";
    } else if (seal.status === "ACTIVE") {
      warrantyStatus = "ACTIVE";
    } else {
      warrantyStatus = "NOT_STARTED";
    }

    const coverageType =
      sku?.warrantyType ??
      (seal.productTier === "AUTHENTIC"
        ? "OFFICIAL_DISTRIBUTOR_REPLACEMENT"
        : "SHOP_REPLACEMENT");

    const response: PublicVerifyResponse = {
      is_valid: true,
      seal_id: seal.sealId,
      product_tier: seal.productTier,
      tier_badge: seal.productTier,
      product: {
        title_en: product?.titleEn ?? "Electronics",
        title_bn: product?.titleBn ?? "ইলেকট্রনিক্স",
        brand_name: brand?.name ?? "Official",
        image_url: "https://cdn.ncamart.com/products/front.webp",
      },
      oem_manufacturer_serial:
        seal.productTier === "AUTHENTIC" ? seal.manufacturerSerial : null,
      qc_verified_at: (qcRecord?.createdAt ?? seal.createdAt).toISOString(),
      technician_code: techCode,
      warranty: {
        status: warrantyStatus,
        warranty_days_total: seal.warrantyDays,
        starts_at: seal.warrantyStart?.toISOString() ?? null,
        expires_at: seal.warrantyEnd?.toISOString() ?? null,
        coverage_type: coverageType,
      },
      start_claim_url: `https://ncamart.com/claims/new?seal_id=${seal.sealId}`,
    };

    return {
      success: true,
      notFound: false,
      response,
    };
  },

  // --------------------------------------------------------------------------
  // 12. Clone Detection Job (Every 5 minutes)
  // --------------------------------------------------------------------------
  async runCloneDetectionJob(now: Date = new Date()): Promise<{
    flagged: number;
    alertsCreated: number;
  }> {
    const since = new Date(now.getTime() - 24 * 3600 * 1000);
    // EXACT SQL threshold: >= 5 distinct devices AND >= 2 distinct districts in 24h
    const candidates = await trustRepo.findClonedSealCandidates(since, 5, 2);

    let alertsCreated = 0;
    for (const c of candidates) {
      // Dedupe per seal per 24h
      const recent = await trustRepo.getRecentCloneAlertBySealId(c.sealId, 24);
      if (!recent) {
        const alert = await trustRepo.createCloneAlert({
          sealId: c.sealId,
          reason: "MULTI_DEVICE_MULTI_DISTRICT",
          distinctDevices: c.distinctDevices,
          distinctDistricts: c.distinctDistricts,
          totalScans24h: c.totalScans24h,
          status: "OPEN",
          createdAt: now,
        });

        alertsCreated++;

        // Emit security alert (Class A internal -> SUPER_ADMIN)
        await emitOutbox(undefined, {
          aggregateType: "security_alert",
          aggregateId: alert.id,
          type: "security.cloned_seal_suspected",
          payload: {
            alertId: alert.id,
            sealId: c.sealId,
            reason: "MULTI_DEVICE_MULTI_DISTRICT",
            distinctDevices: c.distinctDevices,
            distinctDistricts: c.distinctDistricts,
            totalScans24h: c.totalScans24h,
            notificationClass: "CLASS_A",
          },
        });
      }
    }

    return { flagged: candidates.length, alertsCreated };
  },

  // --------------------------------------------------------------------------
  // 13. Admin Clone Alerts Management
  // --------------------------------------------------------------------------
  async listCloneAlerts(
    filter?: { status?: string },
    actor?: Actor
  ): Promise<{ alerts: CloneAlertDto[] }> {
    assertCanManageCloneAlerts(actor ?? null);
    const rows = await trustRepo.listCloneAlerts(filter);
    const alerts: CloneAlertDto[] = rows.map((r) => ({
      id: r.id,
      seal_id: r.sealId,
      reason: r.reason,
      distinct_devices_count: r.distinctDevices,
      distinct_districts: r.distinctDistricts,
      total_scans_24h: r.totalScans24h,
      status: r.status,
      flagged_at: r.createdAt.toISOString(),
      resolved_by: r.resolvedBy,
      notes: r.notes,
    }));
    return { alerts };
  },

  async resolveCloneAlert(
    id: string,
    dto: ResolveCloneAlertDto,
    actor: Actor
  ): Promise<CloneAlertDto> {
    assertCanManageCloneAlerts(actor);
    const existing = await trustRepo.getCloneAlertById(id);
    if (!existing) {
      throw new NotFoundError(`Clone alert '${id}' not found`);
    }

    const updated = await trustRepo.updateCloneAlert(id, {
      status: dto.status,
      resolvedBy: actor.id,
      notes: dto.notes ?? null,
    });

    return {
      id: updated!.id,
      seal_id: updated!.sealId,
      reason: updated!.reason,
      distinct_devices_count: updated!.distinctDevices,
      distinct_districts: updated!.distinctDistricts,
      total_scans_24h: updated!.totalScans24h,
      status: updated!.status,
      flagged_at: updated!.createdAt.toISOString(),
      resolved_by: updated!.resolvedBy,
      notes: updated!.notes,
    };
  },

  // --------------------------------------------------------------------------
  // 14. Warranty Expiry Job (Daily at 02:30)
  // --------------------------------------------------------------------------
  async runWarrantyExpiryJob(now: Date = new Date()): Promise<{ expiredCount: number }> {
    const expiredSeals = await trustRepo.getActiveSealsWithExpiredWarranty(now);
    for (const seal of expiredSeals) {
      await trustRepo.updateSealRecord(seal.id, {
        status: "EXPIRED",
      });

      await trustRepo.createSealEvent({
        sealId: seal.sealId,
        fromStatus: "ACTIVE",
        toStatus: "EXPIRED",
        actorId: "SYSTEM",
        reason: "WARRANTY_EXPIRED",
      });
    }

    return { expiredCount: expiredSeals.length };
  },

  // --------------------------------------------------------------------------
  // 15. Partition Maintenance Job (Runs monthly on 25th)
  // --------------------------------------------------------------------------
  async runPartitionMaintenanceJob(targetDate: Date = new Date()): Promise<{
    createdPartitions: string[];
    droppedPartitions: string[];
  }> {
    const createdPartitions: string[] = [];

    // Next month partition
    const nextMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
    const followingMonthDate = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = String(nextMonthDate.getMonth() + 1).padStart(2, "0");
    const nextTableName = `seal_verifications_${nextYear}_${nextMonth}`;

    await trustRepo.ensureMonthlyPartition(nextTableName, nextMonthDate, followingMonthDate);
    createdPartitions.push(nextTableName);

    // Current month partition
    const curMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const curYear = curMonthDate.getFullYear();
    const curMonth = String(curMonthDate.getMonth() + 1).padStart(2, "0");
    const curTableName = `seal_verifications_${curYear}_${curMonth}`;
    await trustRepo.ensureMonthlyPartition(curTableName, curMonthDate, nextMonthDate);
    createdPartitions.push(curTableName);

    // Drop partitions older than 12 months
    const cutoffDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 12, 1);
    const droppedPartitions = await trustRepo.dropOldPartitions(cutoffDate);

    return { createdPartitions, droppedPartitions };
  },
};

