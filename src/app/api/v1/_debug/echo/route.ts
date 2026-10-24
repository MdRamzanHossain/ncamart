import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

const echoQuerySchema = z.object({
  tag: z.string().optional(),
});

const echoBodySchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  paisa: z.number().int().nonnegative().optional(),
});

export const POST = withRoute(
  {
    method: "POST",
    auth: "public",
    query: echoQuerySchema,
    body: echoBodySchema,
  },
  async ({ body, query, requestId }) => {
    // Only available in dev and test environments
    if (env.NODE_ENV === "production") {
      throw new AppError("ERR_NOT_FOUND", "Debug routes are disabled in production", {}, 404);
    }

    return NextResponse.json({
      success: true,
      requestId,
      echo: {
        message: body.message,
        paisa: body.paisa ?? 0,
        tag: query.tag ?? null,
      },
    });
  }
);
