import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { withRoute } from "../http/route";
import { POST as echoHandler } from "@/app/api/v1/_debug/echo/route";

describe("withRoute and error envelope tests", () => {
  it("executes handler successfully on valid body and query", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/_debug/echo?tag=test-tag", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Hello Nawabpur",
        paisa: 50000,
      }),
    });

    const res = await echoHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.echo.message).toBe("Hello Nawabpur");
    expect(json.echo.paisa).toBe(50000);
    expect(json.echo.tag).toBe("test-tag");
    expect(res.headers.get("x-request-id")).toBeDefined();
  });

  it("returns standard 400 error envelope when body validation fails", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/_debug/echo", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "", // empty message violates min(1)
        paisa: -10, // negative violates nonnegative
      }),
    });

    const res = await echoHandler(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe("ERR_VALIDATION");
    expect(json.error.status).toBe(400);
    expect(json.error.timestamp).toBeDefined();
    expect(json.error.details.issues).toBeDefined();
    expect(res.headers.get("x-request-id")).toBeDefined();
  });

  it("enforces authentication when auth: 'customer' is required", async () => {
    const protectedRoute = withRoute(
      {
        auth: "customer",
      },
      async () => {
        return new Response(JSON.stringify({ ok: true }));
      }
    );

    const req = new NextRequest("http://localhost:3000/api/v1/protected");
    const res = await protectedRoute(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("ERR_UNAUTHENTICATED");
  });
});
