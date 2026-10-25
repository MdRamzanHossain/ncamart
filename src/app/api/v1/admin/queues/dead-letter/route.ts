import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { listDeadLetterJobs } from "@/lib/queues";

const querySchema = z.object({
  start: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "queues.admin",
    query: querySchema,
  },
  async ({ query }) => {
    const jobs = await listDeadLetterJobs(query.start, query.limit);
    return NextResponse.json({ jobs, total: jobs.length }, { status: 200 });
  }
);
