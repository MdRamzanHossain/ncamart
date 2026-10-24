import { withRoute } from "@/lib/http/route";
import { promotionsService, CreateCouponSchema, ListCouponsFilterSchema } from "@/modules/promotions";

export const POST = withRoute(
  {
    auth: "staff",
    body: CreateCouponSchema,
  },
  async ({ actor, body }) => {
    const coupon = await promotionsService.createCoupon(body, actor!);
    return new Response(JSON.stringify({ coupon }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }
);

export const GET = withRoute(
  {
    auth: "staff",
    query: ListCouponsFilterSchema,
  },
  async ({ query }) => {
    const result = await promotionsService.listCoupons(query);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
