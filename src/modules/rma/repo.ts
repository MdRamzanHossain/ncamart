import { eq, desc, asc, and, inArray, sql } from "drizzle-orm";
import { db, Tx } from "@/lib/db";
import { env } from "@/lib/env";
import {
  warrantyClaims,
  claimEvents,
  WarrantyClaimRow,
  InsertWarrantyClaimRow,
  ClaimEventRow,
  InsertClaimEventRow,
} from "./schema";
import { ListClaimsQuery } from "./dto";

// --------------------------------------------------------------------------
// In-Memory Storage for Tests & Mock Mode
// --------------------------------------------------------------------------
const memClaims = new Map<string, WarrantyClaimRow>();
const memClaimEvents = new Map<string, ClaimEventRow[]>();

export const rmaRepo = {
  clearMemoryForTesting(): void {
    memClaims.clear();
    memClaimEvents.clear();
  },

  async createClaim(
    data: InsertWarrantyClaimRow,
    tx?: Tx | null
  ): Promise<WarrantyClaimRow> {
    const id = data.id || crypto.randomUUID();
    const now = new Date();
    const row: WarrantyClaimRow = {
      id,
      claimNumber: data.claimNumber,
      sealId: data.sealId,
      orderId: data.orderId,
      orderItemUnitId: data.orderItemUnitId ?? null,
      customerId: data.customerId,
      claimType: data.claimType,
      issueDescription: data.issueDescription,
      status: data.status ?? "SUBMITTED",
      priority: data.priority ?? "NORMAL",
      decision: data.decision ?? null,
      rejectionReason: data.rejectionReason ?? null,
      resolution: data.resolution ?? null,
      reverseShipmentId: data.reverseShipmentId ?? null,
      replacementOrderId: data.replacementOrderId ?? null,
      slaDueAt: data.slaDueAt ? new Date(data.slaDueAt) : null,
      adjudicatedBy: data.adjudicatedBy ?? null,
      adjudicatedAt: data.adjudicatedAt ? new Date(data.adjudicatedAt) : null,
      closedAt: data.closedAt ? new Date(data.closedAt) : null,
      isNonOriginalOwner: data.isNonOriginalOwner ?? false,
      wantsAssistedTransit: data.wantsAssistedTransit ?? false,
      distributorName: data.distributorName ?? null,
      distributorSentAt: data.distributorSentAt ? new Date(data.distributorSentAt) : null,
      distributorReturnedAt: data.distributorReturnedAt ? new Date(data.distributorReturnedAt) : null,
      distributorOutcome: data.distributorOutcome ?? null,
      liaisonTaskId: data.liaisonTaskId ?? null,
      inspectionNotes: data.inspectionNotes ?? null,
      verifiedDefect: data.verifiedDefect ?? null,
      sealIntact: data.sealIntact ?? null,
      createdAt: data.createdAt ? new Date(data.createdAt) : now,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : now,
    };

    if (env.MOCK_EXTERNAL_SERVICES) {
      memClaims.set(id, row);
      return row;
    }

    try {
      const runner = tx || db;
      const [inserted] = await runner
        .insert(warrantyClaims)
        .values(row)
        .returning();
      if (inserted) {
        memClaims.set(id, inserted);
        return inserted;
      }
      memClaims.set(id, row);
      return row;
    } catch {
      memClaims.set(id, row);
      return row;
    }
  },

  async getClaimById(
    id: string,
    tx?: Tx | null
  ): Promise<WarrantyClaimRow | null> {
    if (env.MOCK_EXTERNAL_SERVICES) {
      return memClaims.get(id) ?? null;
    }

    try {
      const runner = tx || db;
      const [row] = await runner
        .select()
        .from(warrantyClaims)
        .where(eq(warrantyClaims.id, id))
        .limit(1);
      return row ?? memClaims.get(id) ?? null;
    } catch {
      return memClaims.get(id) ?? null;
    }
  },

  async getClaimByNumber(
    claimNumber: string,
    tx?: Tx | null
  ): Promise<WarrantyClaimRow | null> {
    if (env.MOCK_EXTERNAL_SERVICES) {
      for (const claim of memClaims.values()) {
        if (claim.claimNumber.toUpperCase() === claimNumber.toUpperCase()) {
          return claim;
        }
      }
      return null;
    }

    try {
      const runner = tx || db;
      const [row] = await runner
        .select()
        .from(warrantyClaims)
        .where(
          sql`upper(${warrantyClaims.claimNumber}) = upper(${claimNumber})`
        )
        .limit(1);
      if (row) return row;
    } catch {
      // fallback to memory
    }

    for (const claim of memClaims.values()) {
      if (claim.claimNumber.toUpperCase() === claimNumber.toUpperCase()) {
        return claim;
      }
    }
    return null;
  },

  async getClaimByIdOrNumber(
    identifier: string,
    tx?: Tx | null
  ): Promise<WarrantyClaimRow | null> {
    if (identifier.toUpperCase().startsWith("RMA-")) {
      return this.getClaimByNumber(identifier, tx);
    }
    const claim = await this.getClaimById(identifier, tx);
    if (claim) return claim;
    return this.getClaimByNumber(identifier, tx);
  },

  async updateClaim(
    id: string,
    patch: Partial<WarrantyClaimRow>,
    tx?: Tx | null
  ): Promise<WarrantyClaimRow> {
    const existing = await this.getClaimById(id, tx);
    if (!existing) {
      throw new Error(`Warranty claim with ID '${id}' not found`);
    }

    const updated: WarrantyClaimRow = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };

    if (env.MOCK_EXTERNAL_SERVICES) {
      memClaims.set(id, updated);
      return updated;
    }

    try {
      const runner = tx || db;
      const [result] = await runner
        .update(warrantyClaims)
        .set(updated)
        .where(eq(warrantyClaims.id, id))
        .returning();
      if (result) {
        memClaims.set(id, result);
        return result;
      }
      memClaims.set(id, updated);
      return updated;
    } catch {
      memClaims.set(id, updated);
      return updated;
    }
  },

  async getActiveClaimForSeal(
    sealId: string,
    tx?: Tx | null
  ): Promise<WarrantyClaimRow | null> {
    const activeStatuses = [
      "SUBMITTED",
      "UNDER_REVIEW",
      "APPROVED",
      "REVERSE_PICKUP",
      "RECEIVED",
      "INSPECTING",
      "DISTRIBUTOR_LIAISON",
    ];

    if (env.MOCK_EXTERNAL_SERVICES) {
      for (const claim of memClaims.values()) {
        if (
          claim.sealId === sealId &&
          activeStatuses.includes(claim.status)
        ) {
          return claim;
        }
      }
      return null;
    }

    try {
      const runner = tx || db;
      const [row] = await runner
        .select()
        .from(warrantyClaims)
        .where(
          and(
            eq(warrantyClaims.sealId, sealId),
            inArray(warrantyClaims.status, activeStatuses as any)
          )
        )
        .limit(1);
      if (row) return row;
    } catch {
      // fallback
    }

    for (const claim of memClaims.values()) {
      if (claim.sealId === sealId && activeStatuses.includes(claim.status)) {
        return claim;
      }
    }
    return null;
  },

  async listClaims(
    query?: ListClaimsQuery,
    tx?: Tx | null
  ): Promise<WarrantyClaimRow[]> {
    if (env.MOCK_EXTERNAL_SERVICES) {
      let items = Array.from(memClaims.values());
      if (query?.status) {
        items = items.filter((c) => c.status === query.status);
      }
      if (query?.priority) {
        items = items.filter((c) => c.priority === query.priority);
      }
      if (query?.claim_type) {
        items = items.filter((c) => c.claimType === query.claim_type);
      }
      if (query?.customer_id) {
        items = items.filter((c) => c.customerId === query.customer_id);
      }
      if (query?.seal_id) {
        items = items.filter((c) => c.sealId === query.seal_id);
      }

      // Sort: DOA_FAST_TRACK first, then oldest createdAt first
      items.sort((a, b) => {
        if (a.priority === "DOA_FAST_TRACK" && b.priority !== "DOA_FAST_TRACK") {
          return -1;
        }
        if (b.priority === "DOA_FAST_TRACK" && a.priority !== "DOA_FAST_TRACK") {
          return 1;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      const offset = query?.offset ?? 0;
      const limit = query?.limit ?? 50;
      return items.slice(offset, offset + limit);
    }

    try {
      const runner = tx || db;
      const conditions = [];
      if (query?.status) {
        conditions.push(eq(warrantyClaims.status, query.status));
      }
      if (query?.priority) {
        conditions.push(eq(warrantyClaims.priority, query.priority));
      }
      if (query?.claim_type) {
        conditions.push(eq(warrantyClaims.claimType, query.claim_type));
      }
      if (query?.customer_id) {
        conditions.push(eq(warrantyClaims.customerId, query.customer_id));
      }
      if (query?.seal_id) {
        conditions.push(eq(warrantyClaims.sealId, query.seal_id));
      }

      const rows = await runner
        .select()
        .from(warrantyClaims)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          sql`CASE WHEN ${warrantyClaims.priority} = 'DOA_FAST_TRACK' THEN 0 ELSE 1 END`,
          asc(warrantyClaims.createdAt)
        )
        .limit(query?.limit ?? 50)
        .offset(query?.offset ?? 0);

      return rows;
    } catch {
      return Array.from(memClaims.values());
    }
  },

  async listClaimsByCustomerId(
    customerId: string,
    tx?: Tx | null
  ): Promise<WarrantyClaimRow[]> {
    return this.listClaims({ customer_id: customerId } as ListClaimsQuery, tx);
  },

  async recordClaimEvent(
    data: InsertClaimEventRow,
    tx?: Tx | null
  ): Promise<ClaimEventRow> {
    const id = data.id || crypto.randomUUID();
    const now = new Date();
    const row: ClaimEventRow = {
      id,
      claimId: data.claimId,
      fromStatus: data.fromStatus ?? null,
      toStatus: data.toStatus,
      actorType: data.actorType,
      actorId: data.actorId ?? null,
      notes: data.notes ?? null,
      metadata: data.metadata ?? null,
      createdAt: data.createdAt ? new Date(data.createdAt) : now,
    };

    const existingEvents = memClaimEvents.get(data.claimId) ?? [];
    existingEvents.push(row);
    memClaimEvents.set(data.claimId, existingEvents);

    if (env.MOCK_EXTERNAL_SERVICES) {
      return row;
    }

    try {
      const runner = tx || db;
      const [inserted] = await runner
        .insert(claimEvents)
        .values(row)
        .returning();
      return inserted ?? row;
    } catch {
      return row;
    }
  },

  async listClaimEvents(
    claimId: string,
    tx?: Tx | null
  ): Promise<ClaimEventRow[]> {
    if (env.MOCK_EXTERNAL_SERVICES) {
      const list = memClaimEvents.get(claimId) ?? [];
      return [...list].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
    }

    try {
      const runner = tx || db;
      const rows = await runner
        .select()
        .from(claimEvents)
        .where(eq(claimEvents.claimId, claimId))
        .orderBy(asc(claimEvents.createdAt));
      if (rows.length > 0) return rows;
    } catch {
      // fallback
    }

    const list = memClaimEvents.get(claimId) ?? [];
    return [...list].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  },
};
