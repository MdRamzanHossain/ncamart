import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { engagementService } from "@/modules/engagement";

export const dynamic = "force-dynamic";

export const GET = withRoute(
  {
    auth: "public",
    params: z.object({
      slug: z.string().min(1),
    }),
  },
  async ({ params }) => {
    const data = await engagementService.getProductReviews(params.slug);
    return NextResponse.json({
      success: true,
      ...data,
    });
  }
);
