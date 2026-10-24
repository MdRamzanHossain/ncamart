import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { promotionsService, UpdateCouponSchema } from "@/modules/promotions";

export const PUT = withRoute(
  {
    auth: "staff",
    params: z.object({ id: z.string() }),
    body: UpdateCouponSchema,
  },
  async ({ actor, body, params }) => {
    const couponId = params.id;
    const coupon = await promotionsService.updateCoupon(couponId, body, actor!);
    return new Response(JSON.stringify({ coupon }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
