import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { posService, closeDrawerSchema } from "@/modules/pos";

export const POST = withRoute(
  {
    auth: "staff",
    schema: closeDrawerSchema,
  },
  async ({ actor, body }) => {
    const session = await posService.closeDrawer(actor!.id, body, actor!);
    return NextResponse.json({ success: true, session }, { status: 200 });
  }
);
