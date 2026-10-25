import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { retryDeadLetterJob } from "@/lib/queues";

const paramsSchema = z.object({
  id: z.string(),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "queues.admin",
    params: paramsSchema,
  },
  async ({ params }) => {
    const success = await retryDeadLetterJob(params.id);
    if (!success) {
      return NextResponse.json(
        { error: "Dead-letter job not found or unable to retry" },
        { status: 404 }
      );
    }
    return NextResponse.json({ message: "Job successfully retried", id: params.id }, { status: 200 });
  }
);
