import { z } from "./schemas";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type AuthRequirement = "public" | "customer" | "staff" | "internal" | "any";

export interface EndpointDefinition {
  method: HttpMethod;
  path: string;
  sourceFile: string;
  summary: string;
  description: string;
  tags: string[];
  auth: AuthRequirement;
  permission?: string;
  idempotent?: boolean | string;
  rateLimit?: string;
  paramsSchema?: z.ZodTypeAny;
  querySchema?: z.ZodTypeAny;
  bodySchema?: z.ZodTypeAny;
  headersSchema?: z.ZodTypeAny;
  responseStatus?: number;
  responseDescription?: string;
  responseSchema?: z.ZodTypeAny;
}

export interface ScannedRoute {
  file: string;
  method: HttpMethod;
  path: string;
  auth: AuthRequirement;
  permission?: string;
  idempotent?: string;
  rateLimit?: string;
  hasBody: boolean;
  hasQuery: boolean;
  hasParams: boolean;
  paramNames: string[];
}
