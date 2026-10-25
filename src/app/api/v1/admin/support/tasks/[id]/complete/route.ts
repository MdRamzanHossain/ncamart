import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { supportTasksService } from "@/modules/identity/supportTasksService";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  resolution_notes: z.string().min(1, "Resolution notes are required"),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "support.manage",
    params: paramsSchema,
    body: bodySchema,
  },
  async ({ params, body, actor }) => {
    const updated = await supportTasksService.completeTask(
      params.id,
      body.resolution_notes,
      actor!
    );
    return NextResponse.json(updated, { status: 200 });
  }
);
