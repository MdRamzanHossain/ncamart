import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { auditService } from "@/modules/audit";

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "audit.read",
    query: querySchema,
  },
  async ({ query }) => {
    let fromId: bigint | undefined = undefined;
    let toId: bigint | undefined = undefined;

    if (query.from && /^\d+$/.test(query.from)) {
      fromId = BigInt(query.from);
    }
    if (query.to && /^\d+$/.test(query.to)) {
      toId = BigInt(query.to);
    }

    const result = await auditService.verify({ fromId, toId });

    return NextResponse.json(
      {
        valid: result.valid,
        checked_count: result.checkedCount,
        tampered_row_id: result.tamperedRowId ? result.tamperedRowId.toString() : undefined,
        error: result.error,
      },
      { status: result.valid ? 200 : 409 }
    );
  }
);
