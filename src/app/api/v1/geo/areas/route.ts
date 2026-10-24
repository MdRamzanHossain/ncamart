import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { geoService } from "@/modules/identity";

const querySchema = z.object({
  thana_id: z.string().optional(),
});

export const GET = withRoute(
  {
    auth: "public",
    query: querySchema,
  },
  async ({ query }) => {
    const areas = await geoService.getAreas(query?.thana_id);
    return new Response(JSON.stringify(areas), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }
);
