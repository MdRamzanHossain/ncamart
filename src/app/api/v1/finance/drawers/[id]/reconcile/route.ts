import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { posService, reconcileDrawerSchema } from "@/modules/pos";

export const POST = withRoute(
  {
    auth: "staff",
    schema: reconcileDrawerSchema,
  },
  async ({ actor, body, params }) => {
    const { id } = (await params) as { id: string };
    const session = await posService.reconcileDrawer(id, body, actor!);
    return NextResponse.json({ success: true, session }, { status: 200 });
  }
);
