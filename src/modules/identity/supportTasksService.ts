import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { NotFoundError, BusinessError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit";
import { Actor } from "@/lib/http/route";
import { preorderRepo } from "@/modules/preorder/repo";
import {
  supportTasks,
  SupportTaskRow,
  SupportTaskStatus,
  SupportTaskType,
} from "@/modules/preorder/schema";

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

export const supportTasksService = {
  /**
   * List support tasks with optional filtering.
   */
  async listTasks(filters: {
    status?: SupportTaskStatus;
    type?: SupportTaskType;
    assignedTo?: string;
    customerId?: string;
    orderId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    data: SupportTaskRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const offset = (page - 1) * limit;

    const all = await preorderRepo.listSupportTasks({
      status: filters.status,
      type: filters.type,
      assignedTo: filters.assignedTo,
      customerId: filters.customerId,
      orderId: filters.orderId,
    });

    const total = all.length;
    const data = all.slice(offset, offset + limit);

    return { data, total, page, limit };
  },

  /**
   * Assign a support task to a staff member.
   */
  async assignTask(
    taskId: string,
    assignedToStaffId: string,
    actor: Actor
  ): Promise<SupportTaskRow> {
    const tasks = await preorderRepo.listSupportTasks();
    const existing = tasks.find((t) => t.id === taskId);
    if (!existing) {
      throw new NotFoundError("Support Task");
    }

    const updated = await preorderRepo.updateSupportTask(taskId, {
      assignedTo: assignedToStaffId as Uuid,
      status: "ASSIGNED",
    });

    await recordAudit(null, {
      staffId: actor.id,
      actorType: "STAFF",
      action: "support_task.assigned",
      entityType: "SUPPORT_TASK",
      entityId: taskId,
      afterState: { assignedTo: assignedToStaffId, status: "ASSIGNED" },
    });

    return updated;
  },

  /**
   * Complete a support task with resolution notes.
   */
  async completeTask(
    taskId: string,
    resolutionNotes: string,
    actor: Actor
  ): Promise<SupportTaskRow> {
    const tasks = await preorderRepo.listSupportTasks();
    const existing = tasks.find((t) => t.id === taskId);
    if (!existing) {
      throw new NotFoundError("Support Task");
    }

    const now = new Date();
    const updated = await preorderRepo.updateSupportTask(taskId, {
      status: "COMPLETED",
      resolutionNotes,
      completedAt: now,
      completedBy: actor.id as Uuid,
    });

    await recordAudit(null, {
      staffId: actor.id,
      actorType: "STAFF",
      action: "support_task.completed",
      entityType: "SUPPORT_TASK",
      entityId: taskId,
      afterState: {
        status: "COMPLETED",
        resolutionNotes,
        completedBy: actor.id,
      },
    });

    return updated;
  },
};
