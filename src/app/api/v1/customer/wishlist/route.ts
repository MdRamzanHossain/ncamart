import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { addWishlistSchema, engagementService } from "@/modules/engagement";

export const dynamic = "force-dynamic";

export const GET = withRoute(
  {
    auth: "customer",
  },
  async ({ actor }) => {
    const items = await engagementService.getWishlist(actor!.id);
    return NextResponse.json({
      success: true,
      items,
    });
  }
);

export const POST = withRoute(
  {
    auth: "customer",
    body: addWishlistSchema,
  },
  async ({ actor, body }) => {
    const item = await engagementService.addToWishlist(actor!.id, body);
    return NextResponse.json({
      success: true,
      item,
    });
  }
);

export const DELETE = withRoute(
  {
    auth: "customer",
    query: z.object({
      product_id: z.string().uuid("Invalid product_id"),
      sku_id: z.string().uuid().optional(),
    }),
  },
  async ({ actor, query }) => {
    const success = await engagementService.removeFromWishlist(
      actor!.id,
      query.product_id,
      query.sku_id
    );
    return NextResponse.json({
      success,
    });
  }
);
