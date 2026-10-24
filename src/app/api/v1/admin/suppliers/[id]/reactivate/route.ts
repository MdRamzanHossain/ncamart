import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  assertCanManageSuppliers,
} from "@/modules/sourcing";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    assertCanManageSuppliers(actor);
    const updated = await sourcingService.reactivateSupplier(params.id, actor);
    return NextResponse.json(updated, { status: 200 });
  }
);
