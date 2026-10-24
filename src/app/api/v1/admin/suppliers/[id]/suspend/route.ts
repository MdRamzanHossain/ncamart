import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  suspendSupplierSchema,
  assertCanManageSuppliers,
} from "@/modules/sourcing";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
    body: suspendSupplierSchema,
  },
  async ({ params, body, actor }) => {
    assertCanManageSuppliers(actor);
    const updated = await sourcingService.suspendSupplier(
      params.id,
      body.reason,
      actor
    );
    return NextResponse.json(updated, { status: 200 });
  }
);
