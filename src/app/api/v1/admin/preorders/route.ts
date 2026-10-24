import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { preorderService, AdminPreorderFilterSchema } from "@/modules/preorder";

export const GET = withRoute(
  {
    auth: "staff",
    query: AdminPreorderFilterSchema,
  },
  async ({ query, actor }) => {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await preorderService.listPreorders(
      {
        status: query.status,
        sku_id: query.sku_id,
        sku: query.sku,
        eta_overdue: query.eta_overdue as boolean | undefined,
        batch_key: query.batch_key,
        batch: query.batch,
        page,
        limit,
      },
      actor!
    );
    return NextResponse.json(
      {
        items: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
        },
      },
      { status: 200 }
    );
  }
);
