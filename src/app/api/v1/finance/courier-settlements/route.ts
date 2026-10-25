import { withRoute } from "@/lib/http/route";
import { handleCourierCsvUpload } from "../reconciliation/courier-csv/route";

export const POST = withRoute(
  {
    auth: "staff",
    permission: "settlement.reconcile",
  },
  async ({ req, actor }) => {
    return handleCourierCsvUpload(req, actor!);
  }
);
