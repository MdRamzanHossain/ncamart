import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { sourcingService } from "@/modules/sourcing";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "sourcing.quarantine.review",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    const updated = await sourcingService.acceptQuarantinedPurchase(params.id, actor!);
    return NextResponse.json(updated, { status: 200 });
  }
);
