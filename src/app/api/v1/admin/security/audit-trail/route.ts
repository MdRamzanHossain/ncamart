import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { auditService } from "@/modules/audit";

const querySchema = z.object({
  staff_id: z.string().optional(),
  action: z.string().optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "audit.read",
    query: querySchema,
  },
  async ({ query }) => {
    const result = await auditService.query({
      staffId: query.staff_id,
      action: query.action,
      entityType: query.entity_type,
      entityId: query.entity_id,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });

    return NextResponse.json(
      {
        data: result.data.map((r) => ({
          id: r.id.toString(),
          staff_id: r.staffId,
          actor_type: r.actorType,
          action: r.action,
          entity_type: r.entityType,
          entity_id: r.entityId,
          before_state: r.beforeState,
          after_state: r.afterState,
          ip: r.ip,
          user_agent: r.userAgent,
          request_id: r.requestId,
          created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          prev_hash: r.prevHash,
          hash: r.hash,
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
      { status: 200 }
    );
  }
);
