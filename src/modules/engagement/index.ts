// Public boundary for module: engagement
// ONLY export service, events, policies, DTOs, and test helpers.
export * from "./service";
export * from "./events";
export * from "./policies";
export * from "./dto";
export { reviewStatusEnum, type ReviewStatus } from "./schema";

// Test helper export
export { engagementRepo } from "./repo";
