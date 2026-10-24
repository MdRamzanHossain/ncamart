import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ordersService, AdminAddOrderNoteSchema } from "@/modules/orders";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().uuid(),
    }),
    body: AdminAddOrderNoteSchema,
  },
  async ({ params, body, actor }) => {
    const createdNote = await ordersService.addAdminOrderNote(
      actor!,
      params.id,
      body.note
    );
    return NextResponse.json(
      {
        message: "Order note added successfully",
        note: createdNote,
      },
      { status: 201 }
    );
  }
);
