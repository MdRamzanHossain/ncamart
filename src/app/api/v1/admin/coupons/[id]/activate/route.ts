import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { promotionsService } from "@/modules/promotions";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({ id: z.string() }),
  },
  async ({ actor, params }) => {
    const couponId = params.id;
    const coupon = await promotionsService.activateCoupon(couponId, actor!);
    return new Response(JSON.stringify({ coupon }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
