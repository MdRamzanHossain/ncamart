import crypto from "node:crypto";
import { Tx } from "@/lib/db";
import { logger } from "@/lib/logger";
import { enqueueJob } from "@/lib/queues";
import { Actor } from "@/lib/http/route";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  NotificationLogRow,
  InsertNotificationLogRow,
  NotificationChannel,
  NotificationClass,
  NotificationStatus,
} from "./schema";
import { notificationsRepo } from "./repo";
import { notificationsPolicies } from "./policies";
import {
  mapOutboxEventToNotifications,
  MappedNotificationTarget,
  OutboxEventLike,
  PRD_MATRIX_ROWS,
  verifyAllPrdMatrixRowsMapped,
} from "./event-map";
import { renderTemplate } from "./timing";
import { createOptOutToken, verifyOptOutToken, appendOptOutNotice } from "./opt-out";
import { smsCircuitBreaker } from "./circuit-breaker";
import {
  defaultProviders,
  NotificationProviders,
  ProviderSendResult,
} from "./providers";
import {
  DeadLetterQuery,
  DeliveryReceiptWebhookInput,
  RetryDeadLetterResponse,
  UpdateCustomerPreferencesInput,
  CustomerNotificationPreferencesDto,
} from "./dto";

export const MAX_CLASS_A_ATTEMPTS = 3;

export class NotificationsService {
  private providers: NotificationProviders;

  constructor(providers: NotificationProviders = defaultProviders) {
    this.providers = providers;
  }

  /**
   * Set custom providers (useful for test isolation).
   */
  setProvidersForTesting(providers: Partial<NotificationProviders>): void {
    this.providers = { ...this.providers, ...providers };
  }

  /**
   * Reset providers to default.
   */
  resetProviders(): void {
    this.providers = defaultProviders;
  }

  /**
   * Seed templates on startup if empty.
   */
  async seedTemplates(tx?: Tx): Promise<void> {
    await notificationsRepo.seedTemplatesIfEmpty(tx);
  }

  /**
   * Core notify service:
   * Maps an outbox event to targets per PRD §3.10 matrix, validates opt-in preferences,
   * checks quiet hours / timing, and either sends immediately or enqueues a delayed job.
   */
  async notify(
    event: OutboxEventLike,
    now = new Date(),
    tx?: Tx
  ): Promise<NotificationLogRow[]> {
    await this.seedTemplates(tx);

    const targets = mapOutboxEventToNotifications(event, now);
    const createdLogs: NotificationLogRow[] = [];

    for (const target of targets) {
      const log = await this.processNotificationTarget(target, now, tx);
      createdLogs.push(log);
    }

    return createdLogs;
  }

  /**
   * Process a single notification target: checks preferences, schedules or sends.
   */
  async processNotificationTarget(
    target: MappedNotificationTarget,
    now = new Date(),
    tx?: Tx
  ): Promise<NotificationLogRow> {
    const logId = crypto.randomUUID();

    // 1. Check Customer Preferences
    if (target.recipientId && target.recipientType === "CUSTOMER") {
      const prefs = await notificationsRepo.getPreferences(tx, target.recipientId);

      // Class C requires marketingOptIn = true
      if (target.class === "C") {
        if (!prefs?.marketingOptIn) {
          logger.info(
            { recipientId: target.recipientId, template: target.templateCode },
            "Class C promotion skipped due to missing marketing opt-in"
          );
          return notificationsRepo.createLog(tx, {
            id: logId,
            recipientType: target.recipientType,
            recipientId: target.recipientId,
            toAddress: target.toAddress,
            channel: target.channel,
            templateCode: target.templateCode,
            class: target.class,
            status: "SKIPPED_OPT_OUT",
            provider: "SYSTEM",
            attempts: 0,
            scheduledAt: target.scheduledAt,
            payload: target.variables,
          });
        }
      }

      // Check channel opt-outs for Class B
      if (target.channel === "WHATSAPP" && prefs && prefs.whatsappOptIn === false) {
        return notificationsRepo.createLog(tx, {
          id: logId,
          recipientType: target.recipientType,
          recipientId: target.recipientId,
          toAddress: target.toAddress,
          channel: target.channel,
          templateCode: target.templateCode,
          class: target.class,
          status: "SKIPPED_OPT_OUT",
          provider: "SYSTEM",
          attempts: 0,
          scheduledAt: target.scheduledAt,
          payload: target.variables,
        });
      }

      if (target.channel === "EMAIL" && prefs && prefs.emailOptIn === false) {
        return notificationsRepo.createLog(tx, {
          id: logId,
          recipientType: target.recipientType,
          recipientId: target.recipientId,
          toAddress: target.toAddress,
          channel: target.channel,
          templateCode: target.templateCode,
          class: target.class,
          status: "SKIPPED_OPT_OUT",
          provider: "SYSTEM",
          attempts: 0,
          scheduledAt: target.scheduledAt,
          payload: target.variables,
        });
      }
    }

    // 2. Fetch and render template
    let template = await notificationsRepo.getTemplate(
      tx,
      target.templateCode,
      target.channel,
      target.locale
    );

    // Fallback to English if Bengali template not found
    if (!template && target.locale === "bn") {
      template = await notificationsRepo.getTemplate(
        tx,
        target.templateCode,
        target.channel,
        "en"
      );
    }

    const rawBody = template?.body ?? `Notification: ${target.templateCode}`;
    let renderedBody = renderTemplate(rawBody, target.variables, target.locale);
    const rawSubject = template?.subject ?? `NCAMart: ${target.templateCode}`;
    const renderedSubject = renderTemplate(rawSubject, target.variables, target.locale);

    // If Class C: append signed opt-out token link
    if (target.class === "C" && target.recipientId) {
      const optOutToken = createOptOutToken(target.recipientId, target.toAddress);
      renderedBody = appendOptOutNotice(renderedBody, optOutToken, target.locale);
    }

    // 3. Timing / Scheduling Check
    const isFuture = target.scheduledAt.getTime() > now.getTime() + 1000;

    if (isFuture) {
      // Create SCHEDULED log
      const log = await notificationsRepo.createLog(tx, {
        id: logId,
        recipientType: target.recipientType,
        recipientId: target.recipientId,
        toAddress: target.toAddress,
        channel: target.channel,
        templateCode: target.templateCode,
        class: target.class,
        status: "SCHEDULED",
        provider: "QUEUED",
        attempts: 0,
        scheduledAt: target.scheduledAt,
        payload: {
          ...target.variables,
          _renderedBody: renderedBody,
          _renderedSubject: renderedSubject,
          _locale: target.locale,
          _whatsappTemplateName: template?.whatsappTemplateName,
        },
      });

      // Enqueue BullMQ delayed job
      const delayMs = Math.max(0, target.scheduledAt.getTime() - now.getTime());
      await enqueueJob(
        "notifications",
        `send.${target.channel.toLowerCase()}`,
        { logId: log.id },
        { delay: delayMs, jobId: `notif_${log.id}` }
      );

      return log;
    }

    // 4. Send Immediately
    return this.dispatchNotification(
      {
        id: logId,
        recipientType: target.recipientType,
        recipientId: target.recipientId,
        toAddress: target.toAddress,
        channel: target.channel,
        templateCode: target.templateCode,
        class: target.class,
        scheduledAt: target.scheduledAt,
        renderedBody,
        renderedSubject,
        whatsappTemplateName: template?.whatsappTemplateName ?? undefined,
        variables: target.variables,
      },
      now,
      tx
    );
  }

  /**
   * Dispatch a notification to the appropriate channel provider with
   * circuit breaker, fallback routing, and retry / dead-letter handling.
   */
  async dispatchNotification(
    params: {
      id: string;
      recipientType: "CUSTOMER" | "STAFF" | "ADMIN";
      recipientId?: string;
      toAddress: string;
      channel: NotificationChannel;
      templateCode: string;
      class: NotificationClass;
      scheduledAt: Date;
      renderedBody: string;
      renderedSubject: string;
      whatsappTemplateName?: string;
      variables: Record<string, unknown>;
      attemptsSoFar?: number;
    },
    now = new Date(),
    tx?: Tx
  ): Promise<NotificationLogRow> {
    const attempts = (params.attemptsSoFar ?? 0) + 1;
    let sendResult: ProviderSendResult;

    if (params.channel === "SMS") {
      // 1. Check Circuit Breaker for SMS
      const usePrimary = await smsCircuitBreaker.shouldUsePrimary(now.getTime());

      if (usePrimary) {
        // Attempt Primary SMS Provider
        sendResult = await this.providers.smsPrimary.send({
          to: params.toAddress,
          text: params.renderedBody,
        });

        // Record on Circuit Breaker
        await smsCircuitBreaker.recordResult(sendResult.success, now.getTime());

        // If primary fails, failover to secondary SMS route or WhatsApp
        if (!sendResult.success) {
          logger.warn(
            { err: sendResult.error, to: params.toAddress },
            "Primary SMS route failed -> falling back to secondary route"
          );
          sendResult = await this.providers.smsSecondary.send({
            to: params.toAddress,
            text: params.renderedBody,
          });
        }
      } else {
        // Circuit breaker is OPEN -> route directly to secondary SMS or WhatsApp
        logger.info(
          { to: params.toAddress },
          "Primary SMS circuit breaker is OPEN -> routing to secondary SMS route"
        );
        sendResult = await this.providers.smsSecondary.send({
          to: params.toAddress,
          text: params.renderedBody,
        });
      }
    } else if (params.channel === "WHATSAPP") {
      sendResult = await this.providers.whatsapp.send({
        to: params.toAddress,
        templateName: params.whatsappTemplateName ?? "general_update",
        language: "bn",
        bodyParams: [params.renderedBody],
      });
    } else {
      // EMAIL
      sendResult = await this.providers.email.send({
        to: params.toAddress,
        subject: params.renderedSubject,
        html: params.renderedBody,
        text: params.renderedBody.replace(/<[^>]+>/g, ""),
      });
    }

    // Determine final status
    let status: NotificationStatus = "SENT";
    let errorText: string | undefined = undefined;

    if (!sendResult.success) {
      errorText = sendResult.error ?? "Failed to dispatch notification";

      if (params.class === "A") {
        if (attempts >= MAX_CLASS_A_ATTEMPTS) {
          // Class A messages that exhaust retries -> DEAD_LETTER
          status = "DEAD_LETTER";
          logger.error(
            { id: params.id, attempts, error: errorText },
            "Class A notification exhausted retries -> marked DEAD_LETTER"
          );
        } else {
          status = "FAILED";
        }
      } else {
        status = "FAILED";
      }
    }

    const logRow: InsertNotificationLogRow = {
      id: params.id,
      recipientType: params.recipientType,
      recipientId: params.recipientId,
      toAddress: params.toAddress,
      channel: params.channel,
      templateCode: params.templateCode,
      class: params.class,
      status,
      provider: sendResult.provider,
      providerMessageId: sendResult.messageId,
      attempts,
      scheduledAt: params.scheduledAt,
      sentAt: sendResult.success ? new Date() : null,
      error: errorText,
      payload: params.variables,
    };

    // If already exists (e.g. from retry or scheduled job), update it; otherwise create it
    const existing = await notificationsRepo.getLogById(tx, params.id);
    if (existing) {
      return notificationsRepo.updateLog(tx, params.id, logRow);
    }
    return notificationsRepo.createLog(tx, logRow);
  }

  /**
   * Retry a dead-letter notification (Admin / Support action).
   */
  async retryDeadLetterNotification(
    id: string,
    actor: Actor
  ): Promise<RetryDeadLetterResponse> {
    if (!notificationsPolicies.canRetryDeadLetter(actor)) {
      throw new ForbiddenError(
        "Insufficient permissions: requires admin.support or notifications.retry"
      );
    }

    const log = await notificationsRepo.getLogById(undefined, id);
    if (!log) {
      throw new NotFoundError(`Notification log '${id}' not found`);
    }

    let template = await notificationsRepo.getTemplate(
      undefined,
      log.templateCode,
      log.channel,
      "bn"
    );
    if (!template) {
      template = await notificationsRepo.getTemplate(
        undefined,
        log.templateCode,
        log.channel,
        "en"
      );
    }

    const renderedBody =
      (log.payload._renderedBody as string) ||
      renderTemplate(template?.body ?? "", log.payload);
    const renderedSubject =
      (log.payload._renderedSubject as string) ||
      renderTemplate(template?.subject ?? "", log.payload);

    const updated = await this.dispatchNotification({
      id: log.id,
      recipientType: log.recipientType,
      recipientId: log.recipientId ?? undefined,
      toAddress: log.toAddress,
      channel: log.channel,
      templateCode: log.templateCode,
      class: log.class,
      scheduledAt: log.scheduledAt,
      renderedBody,
      renderedSubject,
      whatsappTemplateName: template?.whatsappTemplateName ?? undefined,
      variables: log.payload,
      attemptsSoFar: log.attempts,
    });

    return {
      success: updated.status === "SENT",
      message:
        updated.status === "SENT"
          ? "Notification re-sent successfully"
          : `Retry completed with status: ${updated.status}`,
      log: updated,
    };
  }

  /**
   * List dead-letter logs for Support console.
   */
  async listDeadLetter(
    query: DeadLetterQuery,
    actor: Actor
  ): Promise<{ items: NotificationLogRow[]; total: number }> {
    if (!notificationsPolicies.canViewDeadLetter(actor)) {
      throw new ForbiddenError(
        "Insufficient permissions: requires admin.support or notifications.read"
      );
    }
    return notificationsRepo.listDeadLetterLogs(undefined, query);
  }

  /**
   * Handle delivery receipt webhooks from providers (SMS / WhatsApp / Email).
   */
  async handleDeliveryReceipt(
    provider: string,
    input: DeliveryReceiptWebhookInput
  ): Promise<{ updated: boolean; logId?: string; status?: string }> {
    const msgId = input.providerMessageId || input.messageId;
    if (!msgId) {
      return { updated: false };
    }

    const log = await notificationsRepo.getLogByProviderMessageId(undefined, msgId);
    if (!log) {
      logger.warn({ msgId, provider }, "Delivery receipt received for untracked messageId");
      return { updated: false };
    }

    let newStatus: NotificationStatus = log.status;
    const normalizedInputStatus = input.status.toUpperCase();

    if (normalizedInputStatus.includes("DELIVER")) {
      newStatus = "DELIVERED";
    } else if (
      normalizedInputStatus.includes("FAIL") ||
      normalizedInputStatus.includes("BOUNCE") ||
      normalizedInputStatus.includes("UNDELIV")
    ) {
      newStatus = "FAILED";
    }

    await notificationsRepo.updateLog(undefined, log.id, {
      status: newStatus,
      error: input.error ?? log.error,
    });

    return {
      updated: true,
      logId: log.id,
      status: newStatus,
    };
  }

  /**
   * Update customer notification preferences.
   */
  async updatePreferences(
    customerId: string,
    input: UpdateCustomerPreferencesInput,
    actor?: Actor
  ): Promise<CustomerNotificationPreferencesDto> {
    if (actor && !notificationsPolicies.canManagePreferences(actor, customerId)) {
      throw new ForbiddenError("You can only update your own notification preferences");
    }

    const row = await notificationsRepo.upsertPreferences(undefined, customerId, {
      marketingOptIn: input.marketing_opt_in,
      whatsappOptIn: input.whatsapp_opt_in,
      emailOptIn: input.email_opt_in,
    });

    return {
      customerId: row.customerId,
      marketingOptIn: row.marketingOptIn,
      whatsappOptIn: row.whatsappOptIn,
      emailOptIn: row.emailOptIn,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Process opt-out from signed URL token.
   */
  async processOptOutToken(token: string): Promise<{ success: boolean; message: string }> {
    const verified = verifyOptOutToken(token);
    if (!verified.valid || !verified.customerId) {
      throw new ValidationError(verified.error ?? "Invalid or expired opt-out token");
    }

    await notificationsRepo.upsertPreferences(undefined, verified.customerId, {
      marketingOptIn: false,
    });

    return {
      success: true,
      message: "You have been successfully opted out of promotional notifications.",
    };
  }

  /**
   * Verifies that all 12 PRD §3.10 matrix rows are completely mapped.
   */
  verifyPrdCoverage(): {
    allMapped: boolean;
    totalRows: number;
    mappedRows: number;
  } {
    const res = verifyAllPrdMatrixRowsMapped();
    return {
      allMapped: res.allMapped,
      totalRows: res.totalRows,
      mappedRows: res.mappedRows,
    };
  }
}

export const notificationsService = new NotificationsService();
