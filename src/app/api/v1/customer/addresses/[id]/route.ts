import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { customerService } from "@/modules/identity";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const updateAddressSchema = z.object({
  label: z.enum(["HOME", "OFFICE", "OTHER"]).optional(),
  consignee_name: z.string().trim().optional(),
  contact_phone: z.string().trim().optional(),
  division_id: z.string().trim().optional(),
  district_id: z.string().trim().optional(),
  thana_id: z.string().trim().optional(),
  area_id: z.string().trim().optional().nullable(),
  address_line: z.string().trim().min(5).optional(),
  street_address: z.string().trim().min(5).optional(),
  is_default: z.boolean().optional(),
});

export const PUT = withRoute(
  {
    auth: "customer",
    params: paramsSchema,
    body: updateAddressSchema,
  },
  async ({ actor, params, body }) => {
    const addressLine = body.address_line || body.street_address;

    const updated = await customerService.updateAddress(actor!.id, params.id, {
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
        address: updated,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }
);

export const DELETE = withRoute(
  {
    auth: "customer",
    params: paramsSchema,
  },
  async ({ actor, params }) => {
    await customerService.deleteAddress(actor!.id, params.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Address deleted successfully",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }
);
