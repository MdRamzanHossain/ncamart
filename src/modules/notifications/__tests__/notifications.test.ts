import { describe, it, expect, beforeEach } from "vitest";
import { Actor } from "@/lib/http/route";
import {
  notificationsService,
  notificationsRepo,
  clearMemoryNotificationsForTesting,
  smsCircuitBreaker,
  nextAllowedSendTime,
  computeBalanceReminderTime,
  computeOutForDeliveryTime,
  toBanglaNumerals,
  renderTemplate,
  createOptOutToken,
  verifyOptOutToken,
  verifyAllPrdMatrixRowsMapped,
  PRD_MATRIX_ROWS,
  MockSmsProvider,
  clearAllMemoryProvidersForTesting,
  memSentSms,
  memSentWhatsApp,
  memSentEmail,
} from "../index";

const supportActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000s1",
  type: "staff",
  roles: ["CUSTOMER_SUPPORT"],
  permissions: ["admin.support", "notifications.read", "notifications.retry"],
};

const unauthorizedStaffActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000u1",
  type: "staff",
  roles: ["FIELD_RUNNER"],
  permissions: ["runner.task.own"],
};

describe("P36 — Multi-Channel Notifications", () => {
  let mockPrimarySms: MockSmsProvider;
  let mockSecondarySms: MockSmsProvider;

  beforeEach(async () => {
    clearMemoryNotificationsForTesting();
    clearAllMemoryProvidersForTesting();
    smsCircuitBreaker.resetForTesting();

    mockPrimarySms = new MockSmsProvider();
    mockPrimarySms.name = "MOCK_SMS_PRIMARY";

    mockSecondarySms = new MockSmsProvider();
    mockSecondarySms.name = "MOCK_SMS_SECONDARY";

    notificationsService.setProvidersForTesting({
      smsPrimary: mockPrimarySms,
      smsSecondary: mockSecondarySms,
    });

    await notificationsService.seedTemplates();
  });

  // --------------------------------------------------------------------------
  // Test 1: Class B Event at 23:30 Dhaka Scheduled for 08:00 Next Day
  // --------------------------------------------------------------------------
  describe("1. Quiet Hours & Scheduling", () => {
    it("schedules a Class B event at 23:30 Dhaka for 08:00 next morning", async () => {
      // 23:30 Asia/Dhaka on 2026-03-15 corresponds to 17:30 UTC on 2026-03-15
      const date2330Dhaka = new Date(Date.UTC(2026, 2, 15, 17, 30, 0));

      const scheduledTime = nextAllowedSendTime("B", date2330Dhaka);

      // Expected: 08:00 Asia/Dhaka on 2026-03-16 = 02:00 UTC on 2026-03-16
      const expectedUtc = Date.UTC(2026, 2, 16, 2, 0, 0);
      expect(scheduledTime.getTime()).toBe(expectedUtc);

      // Test with notify() service call for a Class B event (Pre-order in transit)
      const logs = await notificationsService.notify(
        {
          type: "preorder.sourced_in_transit",
          payload: {
            customerId: "cust-101",
            phone: "+8801711223344",
            email: "buyer@example.com",
            orderNumber: "ORD-2026-PO-101",
            etaDate: "2026-03-25",
          },
        },
        date2330Dhaka
      );

      expect(logs.length).toBeGreaterThan(0);
      const smsLog = logs.find((l) => l.channel === "SMS");
      expect(smsLog).toBeDefined();
      expect(smsLog!.status).toBe("SCHEDULED");
      expect(smsLog!.scheduledAt.getTime()).toBe(expectedUtc);
    });

    it("schedules Pre-Order Balance Reminders for 10:00 AM Dhaka", () => {
      // 09:15 Dhaka time -> should schedule for today at 10:00 AM Dhaka
      const date0915Dhaka = new Date(Date.UTC(2026, 2, 15, 3, 15, 0));
      const reminderTime = computeBalanceReminderTime(date0915Dhaka);

      const expectedToday1000 = Date.UTC(2026, 2, 15, 4, 0, 0); // 10:00 Dhaka = 04:00 UTC
      expect(reminderTime.getTime()).toBe(expectedToday1000);

      // 14:30 Dhaka time -> should schedule for tomorrow at 10:00 AM Dhaka
      const date1430Dhaka = new Date(Date.UTC(2026, 2, 15, 8, 30, 0));
      const reminderTomorrow = computeBalanceReminderTime(date1430Dhaka);
      const expectedTomorrow1000 = Date.UTC(2026, 2, 16, 4, 0, 0);
      expect(reminderTomorrow.getTime()).toBe(expectedTomorrow1000);
    });

    it("schedules Out for Delivery for 08:00 AM if triggered before 08:00, or immediate if daytime", () => {
      // 06:30 AM Dhaka -> 08:00 AM today
      const date0630Dhaka = new Date(Date.UTC(2026, 2, 15, 0, 30, 0));
      const outForDeliveryEarly = computeOutForDeliveryTime(date0630Dhaka);
      const expected0800 = Date.UTC(2026, 2, 15, 2, 0, 0);
      expect(outForDeliveryEarly.getTime()).toBe(expected0800);

      // 11:00 AM Dhaka -> immediate
      const date1100Dhaka = new Date(Date.UTC(2026, 2, 15, 5, 0, 0));
      const outForDeliveryDaytime = computeOutForDeliveryTime(date1100Dhaka);
      expect(outForDeliveryDaytime.getTime()).toBe(date1100Dhaka.getTime());
    });
  });

  // --------------------------------------------------------------------------
  // Test 2: Class A Event at 03:00 Dhaka Sends Immediately
  // --------------------------------------------------------------------------
  describe("2. Class A Immediate Dispatch (24/7)", () => {
    it("sends a Class A event at 03:00 Dhaka immediately without delay", async () => {
      // 03:00 Asia/Dhaka = 21:00 UTC previous day
      const date0300Dhaka = new Date(Date.UTC(2026, 2, 14, 21, 0, 0));

      const scheduledTime = nextAllowedSendTime("A", date0300Dhaka);
      expect(scheduledTime.getTime()).toBe(date0300Dhaka.getTime());

      // Trigger Class A OTP verification event
      const logs = await notificationsService.notify(
        {
          type: "auth.otp_generated",
          payload: {
            phone: "+8801811223344",
            otp: "593812",
          },
        },
        date0300Dhaka
      );

      expect(logs.length).toBe(1);
      expect(logs[0].class).toBe("A");
      expect(logs[0].status).toBe("SENT");
      expect(logs[0].attempts).toBe(1);

      // Verify SMS was sent through provider
      expect(memSentSms.length).toBe(1);
      expect(memSentSms[0].to).toBe("+8801811223344");
      // Verify Bengali numerals conversion for OTP
      expect(memSentSms[0].text).toContain("৫৯৩৮১২");
    });
  });

  // --------------------------------------------------------------------------
  // Test 3: Class C Promotional Notification & Opt-In / Opt-Out Rules
  // --------------------------------------------------------------------------
  describe("3. Class C Promotional & Opt-In / Opt-Out Enforcement", () => {
    it("skips Class C promotion if customer has not opted in (marketing_opt_in = false)", async () => {
      const customerId = "cust-optout-001";
      await notificationsRepo.upsertPreferences(undefined, customerId, {
        marketingOptIn: false,
      });

      const dayTime = new Date(Date.UTC(2026, 2, 15, 6, 0, 0)); // 12:00 PM Dhaka

      const logs = await notificationsService.notify(
        {
          type: "promotions.broadcast",
          payload: {
            customerId,
            phone: "+8801755667788",
            title: "Ramadan Flash Sale",
            description: "Up to 30% discount on Anker chargers",
            link: "https://ncamart.com/deals",
          },
        },
        dayTime
      );

      expect(logs.length).toBeGreaterThan(0);
      for (const log of logs) {
        expect(log.status).toBe("SKIPPED_OPT_OUT");
      }
      expect(memSentSms.length).toBe(0);
    });

    it("sends Class C promotion when opted in and appends a signed opt-out URL", async () => {
      const customerId = "cust-optin-002";
      await notificationsRepo.upsertPreferences(undefined, customerId, {
        marketingOptIn: true,
      });

      const dayTime = new Date(Date.UTC(2026, 2, 15, 6, 0, 0)); // 12:00 PM Dhaka

      const logs = await notificationsService.notify(
        {
          type: "promotions.broadcast",
          payload: {
            customerId,
            phone: "+8801755667788",
            title: "Ramadan Flash Sale",
            description: "Up to 30% discount on Anker chargers",
            link: "https://ncamart.com/deals",
          },
        },
        dayTime
      );

      const smsLog = logs.find((l) => l.channel === "SMS");
      expect(smsLog).toBeDefined();
      expect(smsLog!.status).toBe("SENT");

      expect(memSentSms.length).toBe(1);
      const sentText = memSentSms[0].text;
      expect(sentText).toContain("NCAMart স্পেশাল অফার");
      expect(sentText).toContain("/api/v1/notifications/opt-out?token=");

      // Extract and verify token
      const match = sentText.match(/token=([a-zA-Z0-9_.-]+)/);
      expect(match).not.toBeNull();
      const token = match![1];

      const verifyResult = verifyOptOutToken(token);
      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.customerId).toBe(customerId);

      // Process opt-out using endpoint helper
      const optOutResponse = await notificationsService.processOptOutToken(token);
      expect(optOutResponse.success).toBe(true);

      // Verify preference updated to false
      const updatedPrefs = await notificationsRepo.getPreferences(undefined, customerId);
      expect(updatedPrefs?.marketingOptIn).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Test 4: Circuit Breaker on Primary SMS Provider
  // --------------------------------------------------------------------------
  describe("4. SMS Circuit Breaker & Failover", () => {
    it("trips to OPEN state when failures > 10% on min 20 sends, routes to secondary route, and recovers on half-open trial", async () => {
      const now = Date.now();

      // 1. Send 17 successful sends and 3 failed sends (total 20 sends, 3/20 = 15% failure rate > 10%)
      for (let i = 0; i < 17; i++) {
        await smsCircuitBreaker.recordResult(true, now);
      }
      expect(await smsCircuitBreaker.getState(now)).toBe("CLOSED");

      // Now record failures
      await smsCircuitBreaker.recordResult(false, now);
      await smsCircuitBreaker.recordResult(false, now);
      const stateAfterThirdFailure = await smsCircuitBreaker.recordResult(false, now);

      // Circuit breaker should trip to OPEN
      expect(stateAfterThirdFailure).toBe("OPEN");
      expect(await smsCircuitBreaker.getState(now)).toBe("OPEN");
      expect(await smsCircuitBreaker.shouldUsePrimary(now)).toBe(false);

      // 2. Next send should automatically route to secondary SMS provider
      const dispatchTime = new Date(now + 1000);
      const log = await notificationsService.dispatchNotification(
        {
          id: "cb-test-1",
          recipientType: "CUSTOMER",
          toAddress: "+8801700998877",
          channel: "SMS",
          templateCode: "OTP_VERIFICATION",
          class: "A",
          scheduledAt: dispatchTime,
          renderedBody: "Your OTP is 123456",
          renderedSubject: "OTP",
          variables: {},
        },
        dispatchTime
      );

      expect(log.status).toBe("SENT");
      expect(log.provider).toBe("MOCK_SMS_SECONDARY");

      // 3. Fast-forward past 10 minutes (600,000 ms) -> HALF_OPEN state
      const halfOpenTime = now + 10 * 60 * 1000 + 1000;
      expect(await smsCircuitBreaker.getState(halfOpenTime)).toBe("HALF_OPEN");

      // 4. Successful trial send in HALF_OPEN state resets circuit breaker to CLOSED
      const trialResult = await smsCircuitBreaker.recordResult(true, halfOpenTime);
      expect(trialResult).toBe("CLOSED");
      expect(await smsCircuitBreaker.getState(halfOpenTime)).toBe("CLOSED");
      expect(await smsCircuitBreaker.shouldUsePrimary(halfOpenTime)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Test 5: Dead-Letter Queue after Max Retries for Class A
  // --------------------------------------------------------------------------
  describe("5. Retries & Dead-Letter Queue", () => {
    it("marks Class A message as DEAD_LETTER when retries are exhausted, lists in dead-letter, and allows support retry", async () => {
      // Force mock providers to fail
      mockPrimarySms.failNextSendsCount = 10;
      mockSecondarySms.failNextSendsCount = 10;

      const now = new Date();
      const log = await notificationsService.dispatchNotification(
        {
          id: "dlq-test-1",
          recipientType: "CUSTOMER",
          recipientId: "cust-dlq-1",
          toAddress: "+8801799887766",
          channel: "SMS",
          templateCode: "PAYMENT_CONFIRMED",
          class: "A",
          scheduledAt: now,
          renderedBody: "Payment of ৳5,000 confirmed.",
          renderedSubject: "Payment",
          variables: { amount: 5000, tranId: "TRX-12345" },
          attemptsSoFar: 2, // 3rd attempt
        },
        now
      );

      expect(log.status).toBe("DEAD_LETTER");
      expect(log.attempts).toBe(3);
      expect(log.error).toBeDefined();

      // Verify visible at dead-letter queue endpoint for Support
      const deadLetters = await notificationsService.listDeadLetter({ limit: 10, offset: 0 }, supportActor);
      expect(deadLetters.items.length).toBeGreaterThan(0);
      const found = deadLetters.items.find((d) => d.id === "dlq-test-1");
      expect(found).toBeDefined();

      // Verify unauthorized staff cannot view dead-letter queue
      await expect(
        notificationsService.listDeadLetter({ limit: 10, offset: 0 }, unauthorizedStaffActor)
      ).rejects.toThrow("Insufficient permissions");

      // Restore mock provider and execute retry
      mockPrimarySms.failNextSendsCount = 0;
      mockSecondarySms.failNextSendsCount = 0;

      const retryRes = await notificationsService.retryDeadLetterNotification("dlq-test-1", supportActor);
      expect(retryRes.success).toBe(true);
      expect(retryRes.log.status).toBe("SENT");
      expect(retryRes.log.attempts).toBe(4);
    });
  });

  // --------------------------------------------------------------------------
  // Test 6: PRD §3.10 Matrix Coverage Test
  // --------------------------------------------------------------------------
  describe("6. PRD §3.10 Matrix Coverage", () => {
    it("asserts every single trigger row (1 to 12) from the PRD matrix is fully mapped and valid", () => {
      const coverage = verifyAllPrdMatrixRowsMapped();
      expect(coverage.allMapped).toBe(true);
      expect(coverage.totalRows).toBe(12);
      expect(coverage.mappedRows).toBe(12);
      expect(coverage.missingRows).toHaveLength(0);

      // Verify each row matches PRD specification
      for (const row of PRD_MATRIX_ROWS) {
        expect(row.rowNumber).toBeGreaterThanOrEqual(1);
        expect(row.rowNumber).toBeLessThanOrEqual(12);
        expect(["A", "B", "C"]).toContain(row.class);
        expect(row.templateCode).toBeDefined();
      }
    });

    it("verifies all internal alerts used in earlier prompts are seeded and active", async () => {
      const templates = await notificationsRepo.listTemplates();
      const internalCodes = [
        "OVERRIDE_ESCALATION",
        "SUPPLIER_SUSPENDED",
        "STOCK_CHECK_MISMATCH",
        "PAYMENT_MISMATCH",
        "REFUND_SLA_BREACH",
        "SAMPLING_ESCALATION",
        "OUTBOX_LAG_ALERT",
      ];

      for (const code of internalCodes) {
        const found = templates.find((t) => t.code === code && t.isActive);
        expect(found, `Internal template ${code} should be seeded and active`).toBeDefined();
        expect(found!.class).toBe("A");
      }
    });
  });

  // --------------------------------------------------------------------------
  // Test 7: Bangla Numerals & Template Rendering
  // --------------------------------------------------------------------------
  describe("7. Bangla Numerals & Locale Rendering", () => {
    it("converts Latin digits to Bangla numerals accurately", () => {
      expect(toBanglaNumerals(1234567890)).toBe("১২৩৪৫৬৭৮৯০");
      expect(toBanglaNumerals("Amount: 5000")).toBe("Amount: ৫০০০");
      expect(toBanglaNumerals("")).toBe("");
    });

    it("renders templates with Bangla numerals for numeric parameters in bn locale", () => {
      const template = "অর্ডার #{{orderNumber}}-এর মোট প্রদেয় ৳{{total}}।";
      const rendered = renderTemplate(template, { orderNumber: "1099", total: 4500 }, "bn");
      expect(rendered).toBe("অর্ডার #১০৯৯-এর মোট প্রদেয় ৳৪৫০০।");
    });
  });

  // --------------------------------------------------------------------------
  // Test 8: Delivery Receipt Webhook
  // --------------------------------------------------------------------------
  describe("8. Delivery Receipt Webhooks", () => {
    it("updates notification status to DELIVERED when receipt webhook arrives", async () => {
      const log = await notificationsRepo.createLog(undefined, {
        recipientType: "CUSTOMER",
        toAddress: "+8801700112233",
        channel: "SMS",
        templateCode: "ORDER_PLACED",
        class: "A",
        status: "SENT",
        provider: "BD_SMS_PRIMARY",
        providerMessageId: "msg-ext-999888",
        attempts: 1,
        scheduledAt: new Date(),
        sentAt: new Date(),
        payload: {},
      });

      const webhookRes = await notificationsService.handleDeliveryReceipt("BD_SMS_PRIMARY", {
        providerMessageId: "msg-ext-999888",
        status: "DELIVERED",
      });

      expect(webhookRes.updated).toBe(true);
      expect(webhookRes.status).toBe("DELIVERED");

      const updated = await notificationsRepo.getLogById(undefined, log.id);
      expect(updated?.status).toBe("DELIVERED");
    });
  });
});
