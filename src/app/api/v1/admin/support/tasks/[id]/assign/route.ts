import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { supportTasksService } from "@/modules/identity/supportTasksService";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  staff_id: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "support.manage",
    params: paramsSchema,
    body: bodySchema,
  },
  async ({ params, body, actor }) => {
    const updated = await supportTasksService.assignTask(params.id, body.staff_id, actor!);
    return NextResponse.json(updated, { status: 200 });
  }
);
