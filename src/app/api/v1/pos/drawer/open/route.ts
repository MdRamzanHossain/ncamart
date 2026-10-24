import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { posService, openDrawerSchema } from "@/modules/pos";

export const POST = withRoute(
  {
    auth: "staff",
    schema: openDrawerSchema,
  },
  async ({ actor, body }) => {
    const session = await posService.openDrawer(actor!.id, body, actor!);
    return NextResponse.json({ success: true, session }, { status: 201 });
  }
);
