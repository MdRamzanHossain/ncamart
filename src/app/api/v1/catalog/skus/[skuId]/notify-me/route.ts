import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { engagementService } from "@/modules/engagement";

export const dynamic = "force-dynamic";

export const POST = withRoute(
  {
    auth: "customer",
    params: z.object({
      skuId: z.string().uuid("Invalid skuId format"),
    }),
  },
  async ({ actor, params }) => {
    const subscription = await engagementService.subscribeStockAlert(actor!.id, params.skuId);
    return NextResponse.json({
      success: true,
      subscription,
    });
  }
);
