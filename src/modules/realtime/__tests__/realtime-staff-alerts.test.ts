import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { authenticator } from "otplib";
import { Actor } from "@/lib/http/route";
import { staffAuthService } from "@/modules/identity";
import {
  computeStaffChannels,
  publishStaffEvent,
  acknowledgeStaffEvent,
  isStaffEventAcknowledged,
  getStaffEventAck,
  replayEventsSince,
  handleStaffEventStream,
  realtimeBroker,
  RealtimeReplica,
  MAX_CONCURRENT_STREAMS_PER_STAFF,
} from "../index";
import { sanitizeEventData, compareStreamIds } from "../broker";
import { GET as streamRouteGet } from "@/app/api/v1/events/stream/route";
import { POST as ackRoutePost } from "@/app/api/v1/events/[eventId]/ack/route";

describe("P37 — Realtime Staff Alerts (SSE over Redis Pub/Sub)", () => {
  let replicaA: RealtimeReplica;
  let replicaB: RealtimeReplica;

  beforeEach(() => {
    vi.clearAllMocks();
    realtimeBroker.clearForTesting();
    staffAuthService.clearMemoryStaffForTesting();
    replicaA = new RealtimeReplica("simulated-web-replica-A");
    replicaB = new RealtimeReplica("simulated-web-replica-B");
  });

  afterEach(() => {
    replicaA.destroy();
    replicaB.destroy();
  });

  describe("1. Channel computation", () => {
    it("computes all-staff, staff:{id}, and role:{role} channels correctly", () => {
      const actor = {
        id: "stf-uuid-123",
        roles: ["SOURCING_MANAGER", "GODOWN_MANAGER"],
      };

      const channels = computeStaffChannels(actor);

      expect(channels).toContain("all-staff");
      expect(channels).toContain("staff:stf-uuid-123");
      expect(channels).toContain("role:SOURCING_MANAGER");
      expect(channels).toContain("role:GODOWN_MANAGER");
      expect(channels).toHaveLength(4);
    });

    it("handles staff with single role or whitespace cleanly", () => {
      const actor = {
        id: "stf-runner-1",
        roles: ["FIELD_RUNNER "],
      };

      const channels = computeStaffChannels(actor);
      expect(channels).toEqual(["all-staff", "staff:stf-runner-1", "role:FIELD_RUNNER"]);
    });
  });

  describe("2. Multi-replica event delivery (worker -> broker -> simulated replicas)", () => {
    it("two simulated web replicas both deliver an event published by the worker", async () => {
      const replicaAMessages: string[] = [];
      const replicaBMessages: string[] = [];
      const nonMatchingMessages: string[] = [];

      // Staff 1 (Alice) connected to Replica A with role SOURCING_MANAGER
      replicaA.registerStream({
        connectionId: "conn-alice-1",
        staffId: "staff-alice",
        sessionId: "sess-alice",
        channels: ["all-staff", "staff:staff-alice", "role:SOURCING_MANAGER"],
        send: (chunk) => replicaAMessages.push(chunk),
        close: vi.fn(),
        createdAt: Date.now(),
      });

      // Staff 2 (Bob) connected to Replica B with role SOURCING_MANAGER
      replicaB.registerStream({
        connectionId: "conn-bob-1",
        staffId: "staff-bob",
        sessionId: "sess-bob",
        channels: ["all-staff", "staff:staff-bob", "role:SOURCING_MANAGER"],
        send: (chunk) => replicaBMessages.push(chunk),
        close: vi.fn(),
        createdAt: Date.now(),
      });

      // Staff 3 (Charlie) connected to Replica A with role GODOWN_MANAGER
      replicaA.registerStream({
        connectionId: "conn-charlie-1",
        staffId: "staff-charlie",
        sessionId: "sess-charlie",
        channels: ["all-staff", "staff:staff-charlie", "role:GODOWN_MANAGER"],
        send: (chunk) => nonMatchingMessages.push(chunk),
        close: vi.fn(),
        createdAt: Date.now(),
      });

      // Worker publishes event to role:SOURCING_MANAGER
      const eventId = await publishStaffEvent("role:SOURCING_MANAGER", {
        event: "sourcing.override_requested",
        data: {
          overrideId: "ovr_789",
          orderId: "ord_101",
          reason: "Vendor wholesale price bump",
          link: "/admin/sourcing/overrides/ovr_789",
        },
      });

      // Both Replica A (Alice) and Replica B (Bob) received the event
      expect(replicaAMessages).toHaveLength(1);
      expect(replicaBMessages).toHaveLength(1);
      expect(replicaAMessages[0]).toContain(`id: ${eventId}`);
      expect(replicaAMessages[0]).toContain("event: sourcing.override_requested");
      expect(replicaAMessages[0]).toContain('"overrideId":"ovr_789"');

      expect(replicaBMessages[0]).toContain(`id: ${eventId}`);
      expect(replicaBMessages[0]).toContain("event: sourcing.override_requested");

      // Staff 3 (Charlie) has role GODOWN_MANAGER, so should NOT receive sourcing override
      expect(nonMatchingMessages).toHaveLength(0);

      // Worker publishes broadcast to all-staff
      const broadcastId = await publishStaffEvent("all-staff", {
        event: "security.cloned_seal",
        data: {
          sealId: "SEAL-XYZ",
          detectedDistrict: "Chittagong",
          link: "/admin/security/alerts/seal-xyz",
        },
      });

      // All 3 staff members should receive all-staff broadcast
      expect(replicaAMessages).toHaveLength(2);
      expect(replicaBMessages).toHaveLength(2);
      expect(nonMatchingMessages).toHaveLength(1);
      expect(nonMatchingMessages[0]).toContain(`id: ${broadcastId}`);
      expect(nonMatchingMessages[0]).toContain("event: security.cloned_seal");
    });

    it("delivers targeted staff:{id} direct alerts to the specific staff member across replicas", async () => {
      const aliceDirect: string[] = [];
      const bobDirect: string[] = [];

      replicaA.registerStream({
        connectionId: "conn-a",
        staffId: "staff-alice",
        sessionId: "sess-a",
        channels: ["all-staff", "staff:staff-alice"],
        send: (chunk) => aliceDirect.push(chunk),
        close: vi.fn(),
        createdAt: Date.now(),
      });

      replicaB.registerStream({
        connectionId: "conn-b",
        staffId: "staff-bob",
        sessionId: "sess-b",
        channels: ["all-staff", "staff:staff-bob"],
        send: (chunk) => bobDirect.push(chunk),
        close: vi.fn(),
        createdAt: Date.now(),
      });

      await publishStaffEvent("staff:staff-alice", {
        event: "order.new_pickup",
        data: { orderId: "ord_pick_456", link: "/pos/pickups/ord_pick_456" },
      });

      expect(aliceDirect).toHaveLength(1);
      expect(aliceDirect[0]).toContain("event: order.new_pickup");
      expect(bobDirect).toHaveLength(0);
    });
  });

  describe("3. PII Sanitization", () => {
    it("strips customer phone, address, and email from broadcast event payloads", async () => {
      const rawData = {
        orderId: "ord_123",
        link: "/admin/orders/ord_123",
        customerPhone: "+8801711000000",
        phone: "+8801811000000",
        customerAddress: "House 12, Road 4, Dhanmondi, Dhaka",
        address: "Dhanmondi, Dhaka",
        customerEmail: "customer@example.com",
        itemsCount: 3,
      };

      const sanitized = sanitizeEventData(rawData);

      expect(sanitized).toEqual({
        orderId: "ord_123",
        link: "/admin/orders/ord_123",
        itemsCount: 3,
      });
      expect(sanitized).not.toHaveProperty("customerPhone");
      expect(sanitized).not.toHaveProperty("phone");
      expect(sanitized).not.toHaveProperty("customerAddress");
      expect(sanitized).not.toHaveProperty("customerEmail");
    });
  });

  describe("4. Last-Event-ID replay from Redis Stream / memory buffer", () => {
    it("replays only events strictly newer than Last-Event-ID across subscribed channels", async () => {
      // Publish 3 events in sequence
      const id1 = await publishStaffEvent("role:GODOWN_MANAGER", {
        event: "qc.sampling_due",
        data: { skuId: "sku_1", batchId: "b_1" },
      });

      // Small delay to ensure timestamp progression
      await new Promise((r) => setTimeout(r, 5));

      const id2 = await publishStaffEvent("role:GODOWN_MANAGER", {
        event: "dispatch.booking_failed",
        data: { shipmentId: "shp_2", courier: "STEADFAST" },
      });

      await new Promise((r) => setTimeout(r, 5));

      const id3 = await publishStaffEvent("all-staff", {
        event: "payment.hold_review",
        data: { tranId: "tran_3", holdReason: "IP_MISMATCH" },
      });

      // Replay from id1: should return id2 and id3, excluding id1
      const replayed = await replayEventsSince(["role:GODOWN_MANAGER", "all-staff"], id1);

      expect(replayed).toHaveLength(2);
      expect(replayed[0].id).toBe(id2);
      expect(replayed[0].event).toBe("dispatch.booking_failed");
      expect(replayed[1].id).toBe(id3);
      expect(replayed[1].event).toBe("payment.hold_review");

      // Replay from id2: should return only id3
      const replayedFromId2 = await replayEventsSince(["role:GODOWN_MANAGER", "all-staff"], id2);
      expect(replayedFromId2).toHaveLength(1);
      expect(replayedFromId2[0].id).toBe(id3);

      // Replay from id3: should return empty array
      const replayedFromId3 = await replayEventsSince(["role:GODOWN_MANAGER", "all-staff"], id3);
      expect(replayedFromId3).toHaveLength(0);
    });

    it("compares stream IDs accurately using timestamp and sequence parts", () => {
      expect(compareStreamIds("1700000000000-0", "1700000000000-1")).toBeLessThan(0);
      expect(compareStreamIds("1700000000000-1", "1700000000000-0")).toBeGreaterThan(0);
      expect(compareStreamIds("1700000000000-0", "1700000000001-0")).toBeLessThan(0);
      expect(compareStreamIds("1700000000000-0", "1700000000000-0")).toBe(0);
    });
  });

  describe("5. Session revocation terminates active SSE stream", () => {
    it("closes active SSE stream when staff session is revoked", async () => {
      // Seed a staff user with active session
      const { staff: staffUser } = await staffAuthService.createStaff({
        fullName: "Test Revoke Staff",
        email: "revoke.staff@ncamart.com",
        phone: "+8801700000001",
        password: "Password123!",
        roles: ["SOURCING_MANAGER"],
      });

      const loginRes = await staffAuthService.login("revoke.staff@ncamart.com", "Password123!");
      expect("totp_enrollment_required" in loginRes).toBe(true);
      const enrollToken = (loginRes as { enrollment_token: string }).enrollment_token;

      const enrollRes = await staffAuthService.enrollTotp(enrollToken);
      const code = authenticator.generate(enrollRes.secret);
      const { session_token } = await staffAuthService.confirmTotp(enrollToken, code);

      const activeSession = staffAuthService.resolveMemoryStaffSession(session_token);
      expect(activeSession).not.toBeNull();
      const sessionId = activeSession!.id;

      let closeCalled = false;
      const sentChunks: string[] = [];

      replicaA.registerStream({
        connectionId: "conn-revocation-test",
        staffId: staffUser.id,
        sessionId,
        channels: ["all-staff", `staff:${staffUser.id}`],
        send: (chunk) => sentChunks.push(chunk),
        close: () => {
          closeCalled = true;
        },
        createdAt: Date.now(),
      });

      expect(replicaA.totalActiveStreams).toBe(1);

      // Revoke the session remotely
      await staffAuthService.revokeAllStaffSessions(staffUser.id, "super-admin-uuid");

      // Verify session is no longer active
      const isActive = await staffAuthService.isStaffSessionActive(sessionId);
      expect(isActive).toBe(false);

      // Trigger revocation check on the replica
      const closed = await replicaA.checkSessionRevocation("conn-revocation-test");

      expect(closed).toBe(true);
      expect(closeCalled).toBe(true);
      expect(sentChunks.some((c) => c.includes("session_revoked"))).toBe(true);
      expect(replicaA.totalActiveStreams).toBe(0);
    });
  });

  describe("6. Connection limits: max 3 concurrent streams per staff", () => {
    it("allows up to 3 concurrent streams and rejects 4th with 429", () => {
      const staffId = "staff-concurrency-test";

      // Connect 1st stream
      replicaA.registerStream({
        connectionId: "conn-1",
        staffId,
        sessionId: "sess-1",
        channels: ["all-staff"],
        send: vi.fn(),
        close: vi.fn(),
        createdAt: Date.now(),
      });

      // Connect 2nd stream
      replicaA.registerStream({
        connectionId: "conn-2",
        staffId,
        sessionId: "sess-1",
        channels: ["all-staff"],
        send: vi.fn(),
        close: vi.fn(),
        createdAt: Date.now(),
      });

      // Connect 3rd stream
      replicaA.registerStream({
        connectionId: "conn-3",
        staffId,
        sessionId: "sess-1",
        channels: ["all-staff"],
        send: vi.fn(),
        close: vi.fn(),
        createdAt: Date.now(),
      });

      expect(replicaA.getActiveStreamCount(staffId)).toBe(3);

      // Attempt 4th stream: should throw ERR_STREAM_LIMIT_EXCEEDED (429)
      expect(() => {
        replicaA.registerStream({
          connectionId: "conn-4",
          staffId,
          sessionId: "sess-1",
          channels: ["all-staff"],
          send: vi.fn(),
          close: vi.fn(),
          createdAt: Date.now(),
        });
      }).toThrowError(/Maximum 3 concurrent event streams allowed/);

      // Unregister 1 stream (e.g. user closed a tab)
      replicaA.unregisterStream("conn-1");
      expect(replicaA.getActiveStreamCount(staffId)).toBe(2);

      // Now 4th stream succeeds!
      expect(() => {
        replicaA.registerStream({
          connectionId: "conn-4",
          staffId,
          sessionId: "sess-1",
          channels: ["all-staff"],
          send: vi.fn(),
          close: vi.fn(),
          createdAt: Date.now(),
        });
      }).not.toThrow();

      expect(replicaA.getActiveStreamCount(staffId)).toBe(3);
    });
  });

  describe("7. Event acknowledgements (POST /api/v1/events/:eventId/ack)", () => {
    it("acknowledges an alert event and registers staff acknowledgement", async () => {
      const eventId = "evt-ack-100";
      const staffId = "staff-sourcing-lead";

      expect(await isStaffEventAcknowledged(eventId)).toBe(false);

      const ack = await acknowledgeStaffEvent(eventId, staffId);
      expect(ack.eventId).toBe(eventId);
      expect(ack.staffId).toBe(staffId);
      expect(ack.acknowledgedAt).toBeDefined();

      expect(await isStaffEventAcknowledged(eventId)).toBe(true);

      const retrieved = await getStaffEventAck(eventId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.staffId).toBe(staffId);
    });

    it("POST /api/v1/events/[eventId]/ack endpoint registers acknowledgement successfully", async () => {
      // Seed a staff user and create active session
      const { staff: ackStaff } = await staffAuthService.createStaff({
        fullName: "Ack Staff Lead",
        email: "ack.staff@ncamart.com",
        phone: "+8801700000002",
        password: "Password123!",
        roles: ["SOURCING_MANAGER"],
      });

      const loginRes = await staffAuthService.login("ack.staff@ncamart.com", "Password123!");
      const enrollToken = (loginRes as { enrollment_token: string }).enrollment_token;
      const enrollRes = await staffAuthService.enrollTotp(enrollToken);
      const code = authenticator.generate(enrollRes.secret);
      const { session_token } = await staffAuthService.confirmTotp(enrollToken, code);

      const req = new NextRequest("http://localhost:3000/api/v1/events/evt-route-200/ack", {
        method: "POST",
        headers: {
          cookie: `nca_sid=${session_token}`,
        },
      });

      const res = await ackRoutePost(req, {
        params: Promise.resolve({ eventId: "evt-route-200" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.event_id).toBe("evt-route-200");
      expect(json.acknowledged_by).toBeDefined();

      expect(await isStaffEventAcknowledged("evt-route-200")).toBe(true);
    });
  });

  describe("8. GET /api/v1/events/stream SSE endpoint", () => {
    it("returns 200 with text/event-stream headers and keepalive", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/events/stream");

      const actor: Actor = {
        id: "staff-stream-tester",
        type: "staff",
        roles: ["QC_TECHNICIAN"],
        permissions: ["qc.execute"],
      };

      const res = await handleStaffEventStream(req, actor, {
        replica: replicaA,
        heartbeatIntervalMs: 1000,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      expect(res.headers.get("cache-control")).toContain("no-cache");
      expect(res.headers.get("connection")).toBe("keep-alive");
      expect(res.headers.get("x-accel-buffering")).toBe("no");
      expect(res.body).toBeDefined();
    });

    it("rejects non-staff actors with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/events/stream");

      const customerActor: Actor = {
        id: "cust-1",
        type: "customer",
        roles: [],
        permissions: ["catalog.read"],
      };

      await expect(handleStaffEventStream(req, customerActor)).rejects.toThrowError(
        /Staff access required/
      );
    });
  });
});
