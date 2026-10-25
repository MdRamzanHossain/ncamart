import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extend Zod with OpenAPI methods (.openapi(...))
extendZodWithOpenApi(z);

export { z };

/**
 * Standard RFC 7807 compatible error envelope schema
 */
export const ErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({
        example: "ERR_VALIDATION",
        description: "Standard machine-readable error code",
      }),
      message: z.string().openapi({
        example: "Invalid request payload or missing parameters",
        description: "Human-readable bilingual explanation of the error",
      }),
      status: z.number().int().openapi({
        example: 400,
        description: "HTTP status code matching the response",
      }),
      details: z
        .record(z.unknown())
        .optional()
        .openapi({
          example: { field: "phone", message: "Must be a valid Bangladeshi MSISDN" },
          description: "Structured contextual debugging details or validation errors",
        }),
      timestamp: z.string().datetime().openapi({
        example: "2026-10-25T12:00:00.000Z",
        description: "ISO 8601 UTC timestamp of when error occurred",
      }),
    }),
  })
  .openapi({
    title: "ErrorEnvelope",
    description: "Standard NCAMart RFC 7807 error response envelope",
  });

/**
 * Generic success response envelope
 */
export const GenericSuccessSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().optional().openapi({ example: "Operation completed successfully" }),
  })
  .openapi({
    title: "GenericSuccess",
    description: "Standard success response confirmation",
  });

/**
 * Standard pagination query parameters
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional().openapi({
    example: 1,
    description: "Page number (1-indexed)",
  }),
  limit: z.coerce.number().int().positive().max(100).default(50).optional().openapi({
    example: 20,
    description: "Number of records to return per page (max 100)",
  }),
});

/**
 * Idempotency request headers
 */
export const IdempotencyHeaderSchema = z.object({
  "Idempotency-Key": z.string().uuid().optional().openapi({
    example: "0192b0c3-4d5e-7a1b-8c2d-3e4f5a6b7c8d",
    description: "UUIDv7 idempotency key for safely retrying mutating operations",
  }),
  "X-Client-Mutation-Id": z.string().uuid().optional().openapi({
    example: "b553c4cb-02c7-4b77-aa1a-8c7b0fbc1f33",
    description: "Runner PWA offline client mutation UUID",
  }),
});
