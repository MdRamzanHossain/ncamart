import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { moderateReviewSchema, engagementService } from "@/modules/engagement";

export const dynamic = "force-dynamic";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().uuid("Invalid review id"),
    }),
    body: moderateReviewSchema,
  },
  async ({ actor, params, body }) => {
    const review = await engagementService.moderateReview(actor!, params.id, body);
    return NextResponse.json({
      success: true,
      review,
    });
  }
);
