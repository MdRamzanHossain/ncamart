import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AppError,
  ValidationError,
  UnauthenticatedError,
  ForbiddenError,
  OwnershipUnconfirmedError,
  toErrorEnvelope,
} from "../errors";
import { logger } from "../logger";
import { sha256Hex } from "../crypto";
import { uuidv7 } from "../ids";
import { checkRateLimit } from "../ratelimit";
import { beginIdempotency, completeIdempotency } from "../idempotency";
import { env } from "../env";

export type AuthRequirement = "public" | "customer" | "staff" | "any" | "optional";

export interface Actor {
  id: string;
  type: "customer" | "staff" | "system";
  sessionId?: string;
  ownershipUnconfirmed?: boolean;
  roles?: string[];
  permissions?: string[];
}

export interface ActorResolver {
  resolve(req: NextRequest): Promise<Actor | null>;
}

type SessionResolverFn = (token: string) => Promise<Actor | null>;
let globalSessionResolver: SessionResolverFn | null = null;

export function setGlobalSessionResolver(resolver: SessionResolverFn): void {
  globalSessionResolver = resolver;
}

export type PermissionCheckerFn = (
  actor: Actor | null,
  permission: string,
  context?: unknown
) => Promise<boolean> | boolean;

let globalPermissionChecker: PermissionCheckerFn | null = null;

export function setGlobalPermissionChecker(checker: PermissionCheckerFn): void {
  globalPermissionChecker = checker;
}

// Default resolver: checks nca_sid cookie or Authorization: Bearer token
export const defaultActorResolver: ActorResolver = {
  async resolve(req: NextRequest) {
    const cookieToken = req.cookies.get("nca_sid")?.value;
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token = cookieToken || bearerToken;
    if (!token) return null;

    if (globalSessionResolver) {
      return await globalSessionResolver(token);
    }
    return null;
  },
};

export interface RouteConfig<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
> {
  method?: string | string[];
  auth?: AuthRequirement;
  allowUnconfirmed?: boolean;
  permission?: string;
  body?: z.ZodType<TBody>;
  query?: z.ZodType<TQuery>;
  params?: z.ZodType<TParams>;
  schema?: z.ZodType<TBody>;
  querySchema?: z.ZodType<TQuery>;
  idempotent?: string; // scope name, e.g. "checkout"
  rateLimit?: {
    limit: number;
    windowSec: number;
    keyGenerator?: (req: NextRequest) => string;
  };
  actorResolver?: ActorResolver;
}

export interface RouteContext<TBody, TQuery, TParams> {
  req: NextRequest;
  requestId: string;
  actor: Actor | null;
  body: TBody;
  query: TQuery;
  params: TParams;
}

export function withRoute<TBody = unknown, TQuery = unknown, TParams = unknown, TResponse = unknown>(
  config: RouteConfig<TBody, TQuery, TParams>,
  handler: (ctx: RouteContext<TBody, TQuery, TParams>) => Promise<NextResponse<TResponse> | Response>
) {
  return async (
    req: NextRequest,
    context: any = {}
  ): Promise<Response> => {
    const startTime = Date.now();
    const requestId = req.headers.get("x-request-id") || uuidv7();
    const reqLogger = logger.child({ requestId, path: req.nextUrl.pathname, method: req.method });

    let idempotencyKey: string | null = null;
    let idempotencyScope: string | null = null;

    try {
      // 1. Verify HTTP method
      if (config.method) {
        const allowedMethods = Array.isArray(config.method) ? config.method : [config.method];
        if (!allowedMethods.includes(req.method)) {
          return NextResponse.json(
            toErrorEnvelope(new AppError("ERR_VALIDATION", `Method ${req.method} not allowed`, {}, 405)),
            { status: 405, headers: { "x-request-id": requestId } }
          );
        }
      }

      // 2. Sliding-window rate limit
      if (config.rateLimit) {
        const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "127.0.0.1";
        const rateLimitKey = config.rateLimit.keyGenerator
          ? config.rateLimit.keyGenerator(req)
          : `${req.nextUrl.pathname}:${clientIp}`;

        const limitRes = await checkRateLimit(rateLimitKey, config.rateLimit.limit, config.rateLimit.windowSec);
        if (!limitRes.allowed) {
          const err = new AppError(
            "ERR_RATE_LIMITED",
            "Too many requests. Please try again later.",
            { retry_after_sec: limitRes.retryAfterSec },
            429
          );
          return NextResponse.json(toErrorEnvelope(err), {
            status: 429,
            headers: {
              "x-request-id": requestId,
              "retry-after": String(limitRes.retryAfterSec),
            },
          });
        }
      }

      // 3. Parse route parameters
      let resolvedParams: unknown = {};
      if (context?.params) {
        resolvedParams = typeof context.params.then === "function" ? await context.params : context.params;
      }
      if (config.params) {
        const parsed = config.params.safeParse(resolvedParams);
        if (!parsed.success) {
          throw new ValidationError("Invalid route parameters", { issues: parsed.error.issues });
        }
        resolvedParams = parsed.data;
      }

      // 4. Parse query parameters
      let resolvedQuery: unknown = {};
      const activeQuerySchema = config.query ?? config.querySchema;
      if (activeQuerySchema) {
        const searchObj = Object.fromEntries(req.nextUrl.searchParams.entries());
        const parsed = activeQuerySchema.safeParse(searchObj);
        if (!parsed.success) {
          throw new ValidationError("Invalid query parameters", { issues: parsed.error.issues });
        }
        resolvedQuery = parsed.data;
      }

      // 5. Parse body (for mutating requests)
      let resolvedBody: unknown = undefined;
      let rawBodyText = "";
      if (["POST", "PUT", "PATCH"].includes(req.method)) {
        try {
          rawBodyText = await req.text();
          if (rawBodyText) {
            const contentType = req.headers.get("content-type") || "";
            if (contentType.includes("application/x-www-form-urlencoded")) {
              const searchParams = new URLSearchParams(rawBodyText);
              resolvedBody = Object.fromEntries(searchParams.entries());
            } else {
              resolvedBody = JSON.parse(rawBodyText);
            }
          }
        } catch {
          throw new ValidationError("Invalid request body");
        }
      }

      const activeBodySchema = config.body ?? config.schema;
      if (activeBodySchema) {
        const parsed = activeBodySchema.safeParse(resolvedBody ?? {});
        if (!parsed.success) {
          throw new ValidationError("Invalid request body", { issues: parsed.error.issues });
        }
        resolvedBody = parsed.data;
      }

      // 6. Idempotency handling
      if (config.idempotent) {
        idempotencyScope = config.idempotent;
        idempotencyKey = req.headers.get("idempotency-key");

        if (!idempotencyKey) {
          throw new AppError("ERR_IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required for this operation", {}, 400);
        }

        const requestHash = sha256Hex(`${idempotencyKey}:${rawBodyText}`);
        const idempotencyRes = await beginIdempotency(idempotencyKey, idempotencyScope, requestHash);

        if (idempotencyRes.action === "replay") {
          reqLogger.info({ idempotencyKey, idempotencyScope }, "Replaying stored idempotent response");
          return NextResponse.json(idempotencyRes.body, {
            status: idempotencyRes.status,
            headers: {
              "x-request-id": requestId,
              "x-idempotent-replay": "true",
            },
          });
        }
      }

      // 7. Resolve Actor and Authentication
      const resolver = config.actorResolver ?? defaultActorResolver;
      const actor = await resolver.resolve(req);
      const authMode = config.auth ?? "public";

      if (authMode !== "public") {
        if (!actor) {
          throw new UnauthenticatedError("Authentication required");
        }
        if (authMode === "customer") {
          if (actor.type !== "customer") {
            throw new ForbiddenError("Customer access required");
          }
          if (actor.ownershipUnconfirmed && !config.allowUnconfirmed) {
            throw new OwnershipUnconfirmedError();
          }
        }
        if (authMode === "staff" && actor.type !== "staff") {
          throw new ForbiddenError("Staff access required");
        }
      }

      // 8. Permission checks
      if (config.permission) {
        if (!actor) {
          throw new UnauthenticatedError("Authentication required for this permission");
        }
        if (globalPermissionChecker) {
          const allowed = await globalPermissionChecker(actor, config.permission);
          if (!allowed) {
            throw new ForbiddenError(`Missing required permission: ${config.permission}`);
          }
        } else {
          const hasPermission = actor.permissions?.includes(config.permission) ?? false;
          if (!hasPermission) {
            throw new ForbiddenError(`Missing required permission: ${config.permission}`);
          }
        }
      }

      // 9. Execute Handler
      const response = await handler({
        req,
        requestId,
        actor,
        body: resolvedBody as TBody,
        query: resolvedQuery as TQuery,
        params: resolvedParams as TParams,
      });

      // 10. Complete idempotency record on successful execution
      if (idempotencyKey && idempotencyScope) {
        try {
          const clone = response.clone();
          const responseBody = await clone.json().catch(() => null);
          await completeIdempotency(idempotencyKey, idempotencyScope, response.status, responseBody);
        } catch (err) {
          reqLogger.warn({ err }, "Failed to complete idempotency record");
        }
      }

      // Add response headers
      response.headers.set("x-request-id", requestId);
      reqLogger.info({ status: response.status, durationMs: Date.now() - startTime }, "Request completed");
      return response;
    } catch (err: unknown) {
      const appErr =
        err instanceof AppError
          ? err
          : new AppError(
              "ERR_INTERNAL",
              env.NODE_ENV === "production" ? "Internal server error" : (err instanceof Error ? err.message : String(err)),
              {},
              500
            );

      reqLogger.error({ err, code: appErr.code, status: appErr.status }, "Request error");

      const errorEnvelope = toErrorEnvelope(appErr);
      return NextResponse.json(errorEnvelope, {
        status: appErr.status,
        headers: {
          "x-request-id": requestId,
        },
      });
    }
  };
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    toErrorEnvelope(new AppError(code, message, details, status)),
    { status }
  );
}
