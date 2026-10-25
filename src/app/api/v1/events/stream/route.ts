import { withRoute } from "@/lib/http/route";
import { handleStaffEventStream } from "@/modules/realtime";

export const dynamic = "force-dynamic";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ req, actor }) => {
    return await handleStaffEventStream(req, actor!);
  }
);
