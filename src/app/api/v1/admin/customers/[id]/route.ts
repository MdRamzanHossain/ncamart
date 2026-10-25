import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { adminCustomerService } from "@/modules/identity/adminCustomerService";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "pii.read.full",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    const result = await adminCustomerService.getCustomerSupportDetail(params.id, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
