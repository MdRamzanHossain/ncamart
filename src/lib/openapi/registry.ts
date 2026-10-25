import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z, ErrorEnvelopeSchema, GenericSuccessSchema, IdempotencyHeaderSchema } from "./schemas";
import { scanAllRoutes } from "./scanner";
import { getRouteMetadata } from "./metadata";
import { ScannedRoute } from "./types";

export function createOpenApiRegistry() {
  const registry = new OpenAPIRegistry();

  // 1. Register Core Security Schemes
  registry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "nca_sid",
    description: "Session token stored in HttpOnly secure cookie",
  });

  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "Token",
    description: "Mobile/PWA HTTP Authorization header: Bearer <session_token>",
  });

  registry.registerComponent("securitySchemes", "internalSecret", {
    type: "apiKey",
    in: "header",
    name: "x-internal-secret",
    description: "Internal webhook & worker HMAC authentication secret",
  });

  // 2. Register Shared Schemas
  registry.register("ErrorEnvelope", ErrorEnvelopeSchema);
  registry.register("GenericSuccess", GenericSuccessSchema);

  // 3. Scan and register all route handlers
  const scannedRoutes = scanAllRoutes();

  for (const route of scannedRoutes) {
    registerScannedRoute(registry, route);
  }

  return { registry, scannedRoutes };
}

function registerScannedRoute(registry: OpenAPIRegistry, route: ScannedRoute): void {
  const meta = getRouteMetadata(route);
  const method = route.method.toLowerCase() as "get" | "post" | "put" | "delete" | "patch";

  // Build path parameters schema if route has dynamic segments {param}
  let paramsSchema: z.ZodObject<Record<string, z.ZodTypeAny>> | undefined;
  if (route.paramNames.length > 0) {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const p of route.paramNames) {
      shape[p] = z.string().openapi({
        param: { name: p, in: "path" },
        example: p.toLowerCase().includes("id") ? "c4918a22-3819-4b62-8172-108291a92847" : "sample-param",
        description: `Identifier for ${p}`,
      });
    }
    paramsSchema = z.object(shape);
  }

  // Build security requirement
  const security: Record<string, string[]>[] = [];
  if (route.auth === "staff") {
    security.push({ cookieAuth: [] }, { bearerAuth: [] });
  } else if (route.auth === "customer") {
    security.push({ cookieAuth: [] }, { bearerAuth: [] });
  } else if (route.auth === "any") {
    security.push({ cookieAuth: [] }, { bearerAuth: [] });
  }

  // Headers schema (idempotency header if applicable)
  let headersSchema: z.ZodTypeAny | undefined;
  if (route.idempotent || ["POST", "PUT"].includes(route.method)) {
    headersSchema = IdempotencyHeaderSchema;
  }

  // Request body
  let requestBody: any;
  if (["post", "put", "patch"].includes(method)) {
    requestBody = {
      content: {
        "application/json": {
          schema: z.record(z.unknown()).openapi({
            description: "JSON request payload",
          }),
        },
      },
    };
  }

  // Build Responses
  const successStatus = method === "post" ? 201 : 200;
  const responses: Record<string, any> = {
    [successStatus]: {
      description: "Operation executed successfully",
      content: {
        "application/json": {
          schema: GenericSuccessSchema,
        },
      },
    },
    400: {
      description: "Bad Request — Validation failed or missing parameters",
      content: {
        "application/json": {
          schema: ErrorEnvelopeSchema,
        },
      },
    },
    500: {
      description: "Internal Server Error",
      content: {
        "application/json": {
          schema: ErrorEnvelopeSchema,
        },
      },
    },
  };

  if (route.auth !== "public") {
    responses[401] = {
      description: "Unauthorized — Missing or expired session token",
      content: {
        "application/json": {
          schema: ErrorEnvelopeSchema,
        },
      },
    };
    responses[403] = {
      description: "Forbidden — Insufficient permissions or role",
      content: {
        "application/json": {
          schema: ErrorEnvelopeSchema,
        },
      },
    };
  }

  if (route.paramNames.length > 0) {
    responses[404] = {
      description: "Not Found — Requested resource does not exist",
      content: {
        "application/json": {
          schema: ErrorEnvelopeSchema,
        },
      },
    };
  }

  if (route.idempotent) {
    responses[409] = {
      description: "Conflict — Concurrent duplicate idempotency request in progress",
      content: {
        "application/json": {
          schema: ErrorEnvelopeSchema,
        },
      },
    };
  }

  if (route.rateLimit) {
    responses[429] = {
      description: `Too Many Requests — Rate limit exceeded (${route.rateLimit})`,
      content: {
        "application/json": {
          schema: ErrorEnvelopeSchema,
        },
      },
    };
  }

  // Register with zod-to-openapi
  registry.registerPath({
    method,
    path: route.path,
    tags: [meta.tag],
    summary: meta.summary,
    description: meta.description,
    security: security.length > 0 ? security : undefined,
    request: {
      params: paramsSchema,
      headers: headersSchema,
      body: requestBody,
    },
    responses,
  });
}

export function generateOpenApiSpec() {
  const { registry, scannedRoutes } = createOpenApiRegistry();
  const generator = new OpenApiGeneratorV31(registry.definitions);

  const document = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "NCAMart Nawabpur Complex E-Commerce REST API",
      version: "2.0.0",
      description: `
## NCAMart Production REST API Specification

Welcome to the **NCAMart** OpenAPI 3.1 specification. NCAMart is an e-commerce platform rooted in Dhaka's historic Nawabpur tech market, featuring a dual-tier catalog (Authentic vs. Budget Smart), strict Crockford Base32 tamper-evident holographic seals, double-entry financial ledger accounting, pre-order clearance workflows, field-runner physical sourcing, and multi-channel fulfillment.

### Architectural Invariants & Standards:
1. **Monetary Representation:** Integer Paisa (\`1 BDT = 100 Paisa\`).
2. **Percentages:** Integer Basis Points (\`1% = 100 bp\`).
3. **Session Authentication:** \`nca_sid\` HttpOnly cookie or \`Authorization: Bearer <token>\`.
4. **Idempotency:** Mutating operations support \`Idempotency-Key\` (UUIDv7) or \`X-Client-Mutation-Id\`.
5. **Errors:** RFC 7807 compatible error envelope with bilingual messages.
      `.trim(),
      contact: {
        name: "NCAMart Engineering & Compliance",
        email: "engineering@ncamart.com",
        url: "https://ncamart.com",
      },
      license: {
        name: "Proprietary — All Rights Reserved",
      },
    },
    servers: [
      {
        url: "/api/v1",
        description: "Default API Gateway (Relative)",
      },
      {
        url: "https://ncamart.com/api/v1",
        description: "Production Gateway",
      },
      {
        url: "https://staging.ncamart.com/api/v1",
        description: "Staging Environment",
      },
    ],
  });

  return { document, scannedRoutes };
}
