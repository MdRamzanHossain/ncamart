import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { engagementService, reviewStatusEnum } from "@/modules/engagement";

export const dynamic = "force-dynamic";

export const GET = withRoute(
  {
    auth: "staff",
    query: z.object({
      status: z.enum(reviewStatusEnum).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  },
  async ({ actor, query }) => {
    const reviews = await engagementService.listReviewsForModeration(
      actor!,
      query.status,
      query.limit,
      query.offset
    );
    return NextResponse.json({
      success: true,
      reviews,
    });
  }
);
