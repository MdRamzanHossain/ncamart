import { describe, it, expect, afterAll } from "vitest";
import { setupIntegrationTest, IntegrationTestContext } from "./helpers";

describe("Database & Infrastructure (Integration)", () => {
  let context: IntegrationTestContext;

  afterAll(async () => {
    if (context) {
      await context.cleanup();
    }
  });

  it("initializes integration test context and checks connectivity", async () => {
    context = await setupIntegrationTest();
    expect(context.pool).toBeDefined();
    expect(context.db).toBeDefined();
    expect(context.redisUrl).toBeDefined();
  });
});
