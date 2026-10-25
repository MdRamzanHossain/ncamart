import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { updateCartSchema, engagementService } from "@/modules/engagement";

export const dynamic = "force-dynamic";

export const GET = withRoute(
  {
    auth: "customer",
  },
  async ({ actor }) => {
    const cart = await engagementService.getCart(actor!.id);
    return NextResponse.json({
      success: true,
      cart,
    });
  }
);

export const PUT = withRoute(
  {
    auth: "customer",
    body: updateCartSchema,
  },
  async ({ actor, body }) => {
    const cart = await engagementService.syncCart(actor!.id, body);
    return NextResponse.json({
      success: true,
      cart,
    });
  }
);
