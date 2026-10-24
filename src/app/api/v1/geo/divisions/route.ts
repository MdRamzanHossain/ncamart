import { withRoute } from "@/lib/http/route";
import { geoService } from "@/modules/identity";

export const GET = withRoute(
  {
    auth: "public",
  },
  async () => {
    const divisions = await geoService.getDivisions();
    return new Response(JSON.stringify(divisions), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }
);
