import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { customerService } from "@/modules/identity";

export const GET = withRoute(
  {
    auth: "customer",
  },
  async ({ actor }) => {
    const addresses = await customerService.listAddresses(actor!.id);
    return new Response(JSON.stringify({ addresses }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);

const createAddressSchema = z.object({
  label: z.enum(["HOME", "OFFICE", "OTHER"]).optional(),
  consignee_name: z.string().trim().optional(),
  contact_phone: z.string().trim().optional(),
  division_id: z.string().trim().optional(),
  district_id: z.string().trim().min(1),
  thana_id: z.string().trim().min(1),
  area_id: z.string().trim().optional().nullable(),
  address_line: z.string().trim().min(5).optional(),
  street_address: z.string().trim().min(5).optional(), // alias for api-spec §3.2
  is_default: z.boolean().optional(),
}).refine((data) => data.address_line || data.street_address, {
  message: "address_line or street_address is required",
});

export const POST = withRoute(
  {
    auth: "customer",
    body: createAddressSchema,
  },
  async ({ actor, body }) => {
    const addressLine = (body.address_line || body.street_address)!.trim();

    const created = await customerService.createAddress(actor!.id, {
      label: body.label,
      consignee_name: body.consignee_name,
      contact_phone: body.contact_phone,
      division_id: body.division_id,
      district_id: body.district_id,
      thana_id: body.thana_id,
      area_id: body.area_id,
      address_line: addressLine,
      is_default: body.is_default,
    });

    return new Response(
      JSON.stringify({
        success: true,
        address_id: created.id,
        address: created,
      }),
      {
        status: 201,
        headers: { "content-type": "application/json" },
      }
    );
  }
);
