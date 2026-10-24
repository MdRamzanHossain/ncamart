import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { posService, resetPickupPinSchema } from "@/modules/pos";

export const POST = withRoute(
  {
    auth: "staff",
    schema: resetPickupPinSchema,
  },
  async ({ actor, body, params }) => {
    const { id } = (await params) as { id: string };
    const result = await posService.resetPickupPin(id, body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
