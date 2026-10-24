import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { posService } from "@/modules/pos";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ req }) => {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? undefined;
    const result = await posService.getShowroomStock(q);
    return NextResponse.json(result, { status: 200 });
  }
);
