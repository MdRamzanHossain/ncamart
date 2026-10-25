import crypto from "node:crypto";
import { eq, and, sql, desc } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import {
  notificationTemplates,
  notificationLogs,
  customerNotificationPreferences,
  NotificationTemplateRow,
  InsertNotificationTemplateRow,
  NotificationLogRow,
  InsertNotificationLogRow,
  CustomerNotificationPreferencesRow,
  InsertCustomerNotificationPreferencesRow,
  NotificationChannel,
  NotificationStatus,
} from "./schema";
import { SEED_NOTIFICATION_TEMPLATES } from "./templates-seed";
import { DeadLetterQuery } from "./dto";

// --------------------------------------------------------------------------
// In-Memory Fallback Stores for test isolation & offline dev
// --------------------------------------------------------------------------
const memTemplates = new Map<string, NotificationTemplateRow>();
const memLogs = new Map<string, NotificationLogRow>();
const memPreferences = new Map<string, CustomerNotificationPreferencesRow>();

export function clearMemoryNotificationsForTesting(): void {
  memTemplates.clear();
  memLogs.clear();
  memPreferences.clear();
}

export const notificationsRepo = {
  // --------------------------------------------------------------------------
  // 1. Templates
  // --------------------------------------------------------------------------
  async seedTemplatesIfEmpty(tx?: Tx): Promise<void> {
    const client = tx ?? defaultDb;
    const now = new Date();

    // Populate in-memory map
    for (const t of SEED_NOTIFICATION_TEMPLATES) {
      const key = `${t.code}:${t.channel}:${t.locale ?? "bn"}`;
      if (!memTemplates.has(key)) {
        const row: NotificationTemplateRow = {
          id: t.id ?? crypto.randomUUID(),
          code: t.code,
          channel: t.channel,
          locale: t.locale ?? "bn",
          class: t.class,
          subject: t.subject ?? null,
          body: t.body,
          whatsappTemplateName: t.whatsappTemplateName ?? null,
          isActive: t.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        };
        memTemplates.set(key, row);
      }
    }

    try {
      for (const t of SEED_NOTIFICATION_TEMPLATES) {
        await client
          .insert(notificationTemplates)
          .values({
            ...t,
            id: t.id ?? crypto.randomUUID(),
          })
          .onConflictDoNothing();
      }
    } catch {
      // Memory fallback when Postgres offline
    }
  },

  async getTemplate(
    tx: Tx | undefined,
    code: string,
    channel: NotificationChannel,
    locale: "bn" | "en" = "bn"
  ): Promise<NotificationTemplateRow | null> {
    const client = tx ?? defaultDb;

    try {
      const [found] = await client
        .select()
        .from(notificationTemplates)
        .where(
          and(
            eq(notificationTemplates.code, code),
            eq(notificationTemplates.channel, channel),
            eq(notificationTemplates.locale, locale)
          )
        )
        .limit(1);

      if (found) return found;
    } catch {
      // Memory fallback
    }

    const key = `${code}:${channel}:${locale}`;
    return memTemplates.get(key) ?? null;
  },

  async createTemplate(
    tx: Tx | undefined,
    row: InsertNotificationTemplateRow
  ): Promise<NotificationTemplateRow> {
    const client = tx ?? defaultDb;
    const id = row.id ?? crypto.randomUUID();
    const now = new Date();

    const fullRow: NotificationTemplateRow = {
      id,
      code: row.code,
      channel: row.channel,
      locale: row.locale ?? "bn",
      class: row.class,
      subject: row.subject ?? null,
      body: row.body,
      whatsappTemplateName: row.whatsappTemplateName ?? null,
      isActive: row.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const [inserted] = await client
        .insert(notificationTemplates)
        .values(fullRow)
        .returning();
      if (inserted) {
        const key = `${inserted.code}:${inserted.channel}:${inserted.locale}`;
        memTemplates.set(key, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    const key = `${fullRow.code}:${fullRow.channel}:${fullRow.locale}`;
    memTemplates.set(key, fullRow);
    return fullRow;
  },

  async listTemplates(tx?: Tx): Promise<NotificationTemplateRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client.select().from(notificationTemplates);
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }
    return Array.from(memTemplates.values());
  },

  // --------------------------------------------------------------------------
  // 2. Notification Logs
  // --------------------------------------------------------------------------
  async createLog(
    tx: Tx | undefined,
    row: InsertNotificationLogRow
  ): Promise<NotificationLogRow> {
    const client = tx ?? defaultDb;
    const id = row.id ?? crypto.randomUUID();
    const now = new Date();

    const fullRow: NotificationLogRow = {
      id,
      recipientType: row.recipientType ?? "CUSTOMER",
      recipientId: row.recipientId ?? null,
      toAddress: row.toAddress,
      channel: row.channel,
      templateCode: row.templateCode,
      class: row.class,
      status: row.status ?? "QUEUED",
      provider: row.provider,
      providerMessageId: row.providerMessageId ?? null,
      attempts: row.attempts ?? 0,
      scheduledAt: row.scheduledAt ?? now,
      sentAt: row.sentAt ?? null,
      error: row.error ?? null,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      createdAt: row.createdAt ?? now,
    };

    try {
      const [inserted] = await client.insert(notificationLogs).values(fullRow).returning();
      if (inserted) {
        memLogs.set(id, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memLogs.set(id, fullRow);
    return fullRow;
  },

  async getLogById(
    tx: Tx | undefined,
    id: string
  ): Promise<NotificationLogRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [found] = await client
        .select()
        .from(notificationLogs)
        .where(eq(notificationLogs.id, id))
        .limit(1);
      if (found) return found;
    } catch {
      // Memory fallback
    }
    return memLogs.get(id) ?? null;
  },

  async getLogByProviderMessageId(
    tx: Tx | undefined,
    providerMessageId: string
  ): Promise<NotificationLogRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [found] = await client
        .select()
        .from(notificationLogs)
        .where(eq(notificationLogs.providerMessageId, providerMessageId))
        .limit(1);
      if (found) return found;
    } catch {
      // Memory fallback
    }

    for (const log of memLogs.values()) {
      if (log.providerMessageId === providerMessageId) {
        return log;
      }
    }
    return null;
  },

  async updateLog(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertNotificationLogRow>
  ): Promise<NotificationLogRow> {
    const client = tx ?? defaultDb;

    try {
      const [updated] = await client
        .update(notificationLogs)
        .set(updates)
        .where(eq(notificationLogs.id, id))
        .returning();
      if (updated) {
        memLogs.set(id, updated);
        return updated;
      }
    } catch {
      // Memory fallback
    }

    const existing = memLogs.get(id);
    if (!existing) {
      throw new Error(`Notification log '${id}' not found`);
    }

    const merged: NotificationLogRow = {
      ...existing,
      ...updates,
      payload: (updates.payload ?? existing.payload) as Record<string, unknown>,
    };
    memLogs.set(id, merged);
    return merged;
  },

  async listLogs(
    tx: Tx | undefined,
    filter: {
      recipientId?: string;
      status?: NotificationStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ items: NotificationLogRow[]; total: number }> {
    const client = tx ?? defaultDb;
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    try {
      const conditions = [];
      if (filter.recipientId) {
        conditions.push(eq(notificationLogs.recipientId, filter.recipientId));
      }
      if (filter.status) {
        conditions.push(eq(notificationLogs.status, filter.status));
      }

      const rows = await client
        .select()
        .from(notificationLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(notificationLogs.createdAt))
        .limit(limit)
        .offset(offset);

      if (rows.length > 0) {
        return { items: rows, total: rows.length };
      }
    } catch {
      // Memory fallback
    }

    let all = Array.from(memLogs.values());
    if (filter.recipientId) {
      all = all.filter((l) => l.recipientId === filter.recipientId);
    }
    if (filter.status) {
      all = all.filter((l) => l.status === filter.status);
    }
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
    };
  },

  async listDeadLetterLogs(
    tx: Tx | undefined,
    query: DeadLetterQuery = { limit: 50, offset: 0 }
  ): Promise<{ items: NotificationLogRow[]; total: number }> {
    return this.listLogs(tx, {
      status: "DEAD_LETTER",
      limit: query.limit,
      offset: query.offset,
    });
  },

  // --------------------------------------------------------------------------
  // 3. Customer Notification Preferences
  // --------------------------------------------------------------------------
  async getPreferences(
    tx: Tx | undefined,
    customerId: string
  ): Promise<CustomerNotificationPreferencesRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [found] = await client
        .select()
        .from(customerNotificationPreferences)
        .where(eq(customerNotificationPreferences.customerId, customerId))
        .limit(1);
      if (found) return found;
    } catch {
      // Memory fallback
    }

    return memPreferences.get(customerId) ?? null;
  },

  async upsertPreferences(
    tx: Tx | undefined,
    customerId: string,
    prefs: Partial<InsertCustomerNotificationPreferencesRow>
  ): Promise<CustomerNotificationPreferencesRow> {
    const client = tx ?? defaultDb;
    const now = new Date();

    const existing = await this.getPreferences(tx, customerId);
    const toInsert: CustomerNotificationPreferencesRow = {
      customerId,
      marketingOptIn:
        prefs.marketingOptIn ?? existing?.marketingOptIn ?? false,
      whatsappOptIn: prefs.whatsappOptIn ?? existing?.whatsappOptIn ?? true,
      emailOptIn: prefs.emailOptIn ?? existing?.emailOptIn ?? true,
      updatedAt: now,
    };

    try {
      const [upserted] = await client
        .insert(customerNotificationPreferences)
        .values(toInsert)
        .onConflictDoUpdate({
          target: customerNotificationPreferences.customerId,
          set: {
            marketingOptIn: toInsert.marketingOptIn,
            whatsappOptIn: toInsert.whatsappOptIn,
            emailOptIn: toInsert.emailOptIn,
            updatedAt: now,
          },
        })
        .returning();

      if (upserted) {
        memPreferences.set(customerId, upserted);
        return upserted;
      }
    } catch {
      // Memory fallback
    }

    memPreferences.set(customerId, toInsert);
    return toInsert;
  },
};
