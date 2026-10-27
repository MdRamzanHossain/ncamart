import fs from "fs";
import path from "path";

interface OpenApiParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: any;
  example?: any;
}

interface OpenApiOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    content?: {
      "application/json"?: {
        schema?: any;
        example?: any;
        examples?: Record<string, { value: any }>;
      };
    };
  };
  responses?: Record<string, any>;
  security?: Array<Record<string, string[]>>;
}

interface PostmanItem {
  name: string;
  request?: {
    method: string;
    header: Array<{ key: string; value: string; type?: string; description?: string; disabled?: boolean }>;
    body?: {
      mode: string;
      raw: string;
      options?: { raw: { language: string } };
    };
    url: {
      raw: string;
      host: string[];
      path: string[];
      variable?: Array<{ key: string; value: string; description?: string }>;
      query?: Array<{ key: string; value: string; description?: string; disabled?: boolean }>;
    };
    description?: string;
    auth?: any;
  };
  item?: PostmanItem[];
  description?: string;
}

function generateSampleFromSchema(schema: any, components: any, depth = 0): any {
  if (!schema || depth > 4) return {};

  if (schema.$ref) {
    const refKey = schema.$ref.replace("#/components/schemas/", "");
    const resolved = components?.schemas?.[refKey];
    if (resolved) return generateSampleFromSchema(resolved, components, depth + 1);
    return {};
  }

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  if (schema.type === "string") {
    if (schema.format === "date-time") return new Date().toISOString();
    if (schema.format === "uuid") return "0192b0c3-4d5e-7a1b-8c2d-3e4f5a6b7c8d";
    if (schema.enum && schema.enum.length > 0) return schema.enum[0];
    return "string";
  }

  if (schema.type === "integer" || schema.type === "number") {
    if (schema.enum && schema.enum.length > 0) return schema.enum[0];
    return 100;
  }

  if (schema.type === "boolean") {
    return true;
  }

  if (schema.type === "array") {
    if (schema.items) {
      return [generateSampleFromSchema(schema.items, components, depth + 1)];
    }
    return [];
  }

  if (schema.type === "object" || schema.properties) {
    const obj: Record<string, any> = {};
    if (schema.properties) {
      for (const [k, v] of Object.entries(schema.properties)) {
        obj[k] = generateSampleFromSchema(v, components, depth + 1);
      }
    }
    return obj;
  }

  return {};
}

export function generatePostmanCollection() {
  console.log("========================================================");
  console.log("       NCAMart Postman v2.1.0 Collection Generator      ");
  console.log("========================================================");

  const openApiPath = path.resolve(process.cwd(), "docs/openapi.json");
  if (!fs.existsSync(openApiPath)) {
    throw new Error(`OpenAPI spec not found at ${openApiPath}`);
  }

  const spec = JSON.parse(fs.readFileSync(openApiPath, "utf8"));
  const components = spec.components || {};

  const foldersMap = new Map<string, PostmanItem[]>();

  let totalOperations = 0;

  for (const [routePath, methods] of Object.entries(spec.paths as Record<string, any>)) {
    for (const [methodUpper, opAny] of Object.entries(methods)) {
      const method = methodUpper.toUpperCase();
      if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method)) continue;

      const op = opAny as OpenApiOperation;
      totalOperations++;

      const tag = op.tags?.[0] || "General";
      const name = op.summary || `${method} ${routePath}`;

      // Headers
      const headers: Array<{ key: string; value: string; type?: string; description?: string; disabled?: boolean }> = [
        { key: "Accept", value: "application/json", type: "text" },
      ];

      if (["POST", "PUT", "PATCH"].includes(method)) {
        headers.push({ key: "Content-Type", value: "application/json", type: "text" });
        headers.push({
          key: "Idempotency-Key",
          value: "{{$guid}}",
          type: "text",
          description: "UUIDv7 idempotency key for safe mutating requests",
        });
      }

      // Query params & Path variables
      const queryParams: Array<{ key: string; value: string; description?: string; disabled?: boolean }> = [];
      const pathVariables: Array<{ key: string; value: string; description?: string }> = [];

      if (op.parameters) {
        for (const p of op.parameters) {
          if (p.in === "query") {
            const val = p.example !== undefined ? String(p.example) : (p.schema?.default !== undefined ? String(p.schema.default) : "");
            queryParams.push({
              key: p.name,
              value: val,
              description: p.description || "",
              disabled: !p.required,
            });
          } else if (p.in === "path") {
            const val = p.example !== undefined ? String(p.example) : "c4918a22-3819-4b62-8172-108291a92847";
            pathVariables.push({
              key: p.name,
              value: val,
              description: p.description || "",
            });
          } else if (p.in === "header") {
            headers.push({
              key: p.name,
              value: p.example !== undefined ? String(p.example) : "",
              description: p.description || "",
              disabled: !p.required,
            });
          }
        }
      }

      // Convert path {param} to :param for Postman
      const postmanPathStr = routePath.replace(/\{([^}]+)\}/g, ":$1");
      const pathSegments = postmanPathStr.split("/").filter(Boolean);

      // Body
      let body: any = undefined;
      if (op.requestBody?.content?.["application/json"]) {
        const jsonSchema = op.requestBody.content["application/json"].schema;
        const jsonExample =
          op.requestBody.content["application/json"].example ||
          (op.requestBody.content["application/json"].examples
            ? Object.values(op.requestBody.content["application/json"].examples)[0]?.value
            : undefined);

        const sample = jsonExample || generateSampleFromSchema(jsonSchema, components);
        body = {
          mode: "raw",
          raw: JSON.stringify(sample, null, 2),
          options: {
            raw: {
              language: "json",
            },
          },
        };
      }

      // Auth
      let auth: any = undefined;
      if (op.security && op.security.length > 0) {
        const secScheme = Object.keys(op.security[0])[0];
        if (secScheme === "bearerAuth") {
          auth = {
            type: "bearer",
            bearer: [{ key: "token", value: "{{bearerToken}}", type: "string" }],
          };
        } else if (secScheme === "cookieAuth") {
          headers.push({
            key: "Cookie",
            value: "nca_sid={{sessionToken}}",
            type: "text",
            description: "Session authentication cookie",
          });
        } else if (secScheme === "internalSecret") {
          headers.push({
            key: "x-internal-secret",
            value: "{{internalSecret}}",
            type: "text",
            description: "Worker/Internal HMAC authentication secret",
          });
        }
      }

      const item: PostmanItem = {
        name,
        request: {
          method,
          header: headers,
          body,
          url: {
            raw: `{{baseUrl}}${postmanPathStr}`,
            host: ["{{baseUrl}}"],
            path: pathSegments,
            variable: pathVariables.length > 0 ? pathVariables : undefined,
            query: queryParams.length > 0 ? queryParams : undefined,
          },
          description: op.description || op.summary || "",
          auth,
        },
      };

      if (!foldersMap.has(tag)) {
        foldersMap.set(tag, []);
      }
      foldersMap.get(tag)!.push(item);
    }
  }

  // Build folder hierarchy
  const items: PostmanItem[] = [];

  for (const [tag, folderItems] of Array.from(foldersMap.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    items.push({
      name: tag,
      description: `Endpoints related to ${tag}`,
      item: folderItems,
    });
  }

  const collection = {
    info: {
      _postman_id: "ncamart-ecommerce-api-v2",
      name: "NCAMart Nawabpur Complex E-Commerce REST API",
      description: spec.info.description,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      version: spec.info.version,
    },
    item: items,
    variable: [
      {
        key: "baseUrl",
        value: "http://127.0.0.1:3000",
        type: "string",
        description: "Base API host and port (without trailing slash)",
      },
      {
        key: "sessionToken",
        value: "",
        type: "string",
        description: "Staff / Customer session cookie token (nca_sid)",
      },
      {
        key: "bearerToken",
        value: "",
        type: "string",
        description: "Mobile/PWA Bearer session token",
      },
      {
        key: "internalSecret",
        value: "nca_internal_worker_secret_key_2026",
        type: "string",
        description: "Internal webhook and worker authorization secret",
      },
    ],
  };

  // 1. Write docs/postman/NCAMart.postman_collection.json (for single-file import)
  const docsPostmanDir = path.resolve(process.cwd(), "docs/postman");
  fs.mkdirSync(docsPostmanDir, { recursive: true });
  const collectionFile = path.join(docsPostmanDir, "NCAMart.postman_collection.json");
  fs.writeFileSync(collectionFile, JSON.stringify(collection, null, 2), "utf8");

  // 2. Write Postman v3 YAML Environments
  const envDir = path.resolve(process.cwd(), "postman/environments");
  fs.mkdirSync(envDir, { recursive: true });

  const localYaml = `name: Local
values:
  - key: baseUrl
    value: http://127.0.0.1:3000
    enabled: true
  - key: sessionToken
    value: ""
    enabled: true
    secret: true
  - key: bearerToken
    value: ""
    enabled: true
    secret: true
  - key: internalSecret
    value: nca_internal_worker_secret_key_2026
    enabled: true
    secret: true
`;

  const prodYaml = `name: Production
values:
  - key: baseUrl
    value: https://ncamart.com
    enabled: true
  - key: sessionToken
    value: ""
    enabled: true
    secret: true
  - key: bearerToken
    value: ""
    enabled: true
    secret: true
  - key: internalSecret
    value: ""
    enabled: true
    secret: true
`;

  fs.writeFileSync(path.join(envDir, "Local.environment.yaml"), localYaml, "utf8");
  fs.writeFileSync(path.join(envDir, "Production.environment.yaml"), prodYaml, "utf8");

  console.log(`Generated Categories/Tags: ${foldersMap.size} modules`);
  console.log(`Total Operations:         ${totalOperations} endpoints`);
  console.log(`Collection Output:        ${path.relative(process.cwd(), collectionFile)}`);
  console.log(`Environments Output:      ${path.relative(process.cwd(), envDir)}`);
  console.log("========================================================\n");

  return { collectionFile, totalOperations, folderCount: foldersMap.size };
}

generatePostmanCollection();
