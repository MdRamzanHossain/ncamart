import { CourierAdapter } from "./types";
import { SteadfastAdapter } from "./steadfast";
import { PathaoAdapter } from "./pathao";
import { RedXAdapter } from "./redx";
import { MockCourierAdapter } from "./mock";
import { env } from "@/lib/env";

export * from "./types";
export * from "./steadfast";
export * from "./pathao";
export * from "./redx";
export * from "./mock";

const adapterRegistry = new Map<string, CourierAdapter>();

// Initialize default singletons
const steadfast = new SteadfastAdapter();
const pathao = new PathaoAdapter();
const redx = new RedXAdapter();
const mock = new MockCourierAdapter();

adapterRegistry.set("steadfast", steadfast);
adapterRegistry.set("pathao", pathao);
adapterRegistry.set("redx", redx);
adapterRegistry.set("mock", mock);

/**
 * Register or override an adapter (useful for unit tests and simulations).
 */
export function registerCourierAdapter(code: string, adapter: CourierAdapter): void {
  adapterRegistry.set(code.toLowerCase(), adapter);
}

/**
 * Resolve courier adapter by code.
 * If external services are mocked (env.MOCK_EXTERNAL_SERVICES = true),
 * defaults to mock adapter unless an explicit non-mock adapter is registered.
 */
export function getCourierAdapter(code: string): CourierAdapter {
  const normalized = code.toLowerCase().trim();

  // If running in mock external mode and code isn't explicitly resolved to a custom mock,
  // we can use MockCourierAdapter for seamless offline development
  if (env.MOCK_EXTERNAL_SERVICES && normalized === "mock") {
    return mock;
  }

  const found = adapterRegistry.get(normalized);
  if (found) {
    // If mock mode is strictly active and found is a live HTTP client, we can still fall back to mock
    if (env.MOCK_EXTERNAL_SERVICES && normalized !== "steadfast" && normalized !== "pathao" && normalized !== "redx") {
      return mock;
    }
    return found;
  }

  // Fallback to mock adapter
  return mock;
}
