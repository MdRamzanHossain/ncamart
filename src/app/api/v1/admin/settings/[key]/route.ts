import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { settingsService, SettingKey, SETTINGS_SCHEMAS } from "@/modules/settings";
import { recordAudit } from "@/modules/audit";

const paramsSchema = z.object({
  key: z.string(),
});

const putBodySchema = z.object({
  value: z.unknown(),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "settings.manage",
    params: paramsSchema,
  },
  async ({ params }) => {
    const key = params.key as SettingKey;
    if (!SETTINGS_SCHEMAS[key]) {
      return NextResponse.json(
        { error: `Unknown configuration setting key: ${params.key}` },
        { status: 404 }
      );
    }

    const value = await settingsService.get(key);
    return NextResponse.json({ key, value }, { status: 200 });
  }
);

export const PUT = withRoute(
  {
    auth: "staff",
    permission: "settings.manage",
    params: paramsSchema,
    body: putBodySchema,
  },
  async ({ params, body, actor }) => {
    const key = params.key as SettingKey;
    const schema = SETTINGS_SCHEMAS[key];
    if (!schema) {
      return NextResponse.json(
        { error: `Unknown configuration setting key: ${params.key}` },
        { status: 404 }
      );
    }

    // Zod validate value against setting's specific schema
    const validated = schema.parse(body.value);

    // Get current before-value for audit comparison
    let beforeValue: unknown = undefined;
    try {
      beforeValue = await settingsService.get(key);
    } catch {
      // Ignored
    }

    // Update setting in DB and caches
    await settingsService.set(key, validated as any, actor!.id);

    // Record audit before/after
    await recordAudit(null, {
      staffId: actor!.id,
      actorType: "STAFF",
      action: "settings.updated",
      entityType: "SETTING",
      entityId: key,
      beforeState: { value: beforeValue },
      afterState: { value: validated },
    });

    return NextResponse.json({ key, value: validated }, { status: 200 });
  }
);
