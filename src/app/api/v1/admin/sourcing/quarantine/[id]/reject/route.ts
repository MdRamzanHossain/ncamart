import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { sourcingService } from "@/modules/sourcing";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "sourcing.quarantine.review",
    params: paramsSchema,
    body: bodySchema,
  },
  async ({ params, body, actor }) => {
    const updated = await sourcingService.rejectQuarantinedPurchase(
      params.id,
      body.reason,
      actor!
    );
    return NextResponse.json(updated, { status: 200 });
  }
);
