import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { createReviewSchema, engagementService } from "@/modules/engagement";

export const dynamic = "force-dynamic";

export const POST = withRoute(
  {
    auth: "customer",
    body: createReviewSchema,
  },
  async ({ actor, body }) => {
    const review = await engagementService.submitReview(actor!, body);
    return NextResponse.json(
      {
        success: true,
        review,
      },
      { status: 201 }
    );
  }
);
