import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateOpenApiSpec } from "@/lib/openapi/registry";

export async function GET(): Promise<Response> {
  const filePath = path.resolve(process.cwd(), "docs/openapi.json");

  let spec: any;
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      spec = JSON.parse(content);
    } catch {
      spec = generateOpenApiSpec().document;
    }
  } else {
    spec = generateOpenApiSpec().document;
  }

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
