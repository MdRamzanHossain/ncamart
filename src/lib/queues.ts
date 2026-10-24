import { Queue, Worker, Job, JobsOptions, Processor } from "bullmq";
import { getBullMQConnection } from "./redis";
import { env } from "./env";
import { logger } from "./logger";

export const QUEUE_NAMES = [
  "outbox-dispatch",
  "notifications",
  "courier",
  "payments",
  "search",
  "analytics",
  "media",
  "finance",
  "maintenance",
  "dead-letter",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 5000,
  },
};

// Queue instances cache
const queuesMap = new Map<QueueName, Queue>();

// In-memory queue fallback for mock mode or tests without Redis
interface MockJob {
  id: string;
  name: string;
  data: unknown;
  opts?: JobsOptions;
  queue: QueueName;
  failedReason?: string;
  timestamp: number;
}
const memQueueJobs: MockJob[] = [];

/**
 * Get or initialize a BullMQ Queue singleton for the given queue name.
 */
export function getQueue(queueName: QueueName): Queue | null {
  if (env.MOCK_EXTERNAL_SERVICES) {
    return null;
  }

  if (!queuesMap.has(queueName)) {
    try {
      const connection = getBullMQConnection();
      const queue = new Queue(queueName, {
        connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
      queuesMap.set(queueName, queue);
    } catch (err) {
      logger.warn({ err, queueName }, "Failed to initialize BullMQ queue, using in-memory mock");
      return null;
    }
  }

  return queuesMap.get(queueName) ?? null;
}

/**
 * Enqueue a job into a named BullMQ queue with automatic deduplication by jobId.
 */
export async function enqueueJob<T = unknown>(
  queueName: QueueName,
  jobName: string,
  data: T,
  opts?: JobsOptions
): Promise<string> {
  const jobId = opts?.jobId ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  if (env.MOCK_EXTERNAL_SERVICES) {
    // Check in-memory deduplication by jobId
    const existing = memQueueJobs.find((j) => j.queue === queueName && j.id === jobId);
    if (!existing) {
      memQueueJobs.push({
        id: jobId,
        name: jobName,
        data,
        opts,
        queue: queueName,
        timestamp: Date.now(),
      });
    }
    return jobId;
  }

  const queue = getQueue(queueName);
  if (!queue) {
    memQueueJobs.push({
      id: jobId,
      name: jobName,
      data,
      opts,
      queue: queueName,
      timestamp: Date.now(),
    });
    return jobId;
  }

  try {
    const job = await queue.add(jobName, data, {
      ...DEFAULT_JOB_OPTIONS,
      ...opts,
      jobId,
    });
    return job.id ?? jobId;
  } catch (err) {
    logger.warn({ err, queueName, jobName }, "Failed to enqueue into Redis BullMQ, buffering in memory");
    memQueueJobs.push({
      id: jobId,
      name: jobName,
      data,
      opts,
      queue: queueName,
      timestamp: Date.now(),
    });
    return jobId;
  }
}

/**
 * Create a BullMQ worker for a specific queue with automatic error logging and dead-letter handling.
 */
export function createWorker<T = unknown>(
  queueName: QueueName,
  processor: Processor<T>,
  concurrency = 5
): Worker<T> | null {
  if (env.MOCK_EXTERNAL_SERVICES) {
    return null;
  }

  try {
    const connection = getBullMQConnection();
    const worker = new Worker<T>(queueName, processor, {
      connection,
      concurrency,
    });

    worker.on("failed", async (job, err) => {
      logger.error({ err, queueName, jobId: job?.id }, "BullMQ job failed");
      if (job && job.attemptsMade >= (job.opts.attempts ?? DEFAULT_JOB_OPTIONS.attempts ?? 5)) {
        await moveToDeadLetter(queueName, job, err.message);
      }
    });

    return worker;
  } catch (err) {
    logger.warn({ err, queueName }, "Failed to create BullMQ worker");
    return null;
  }
}

/**
 * Move a permanently failed job to the dead-letter queue.
 */
export async function moveToDeadLetter(
  sourceQueue: QueueName,
  job: Job | MockJob,
  failureReason: string
): Promise<void> {
  logger.error(
    { sourceQueue, jobId: job.id, failureReason },
    "Moving failed job to dead-letter queue"
  );

  await enqueueJob("dead-letter", `failed-${job.name}`, {
    originalQueue: sourceQueue,
    originalJobId: job.id,
    originalData: job.data,
    failureReason,
    timestamp: Date.now(),
  });
}

/**
 * List jobs in the dead-letter queue for operator inspection.
 */
export async function listDeadLetterJobs(start = 0, limit = 50): Promise<MockJob[]> {
  if (env.MOCK_EXTERNAL_SERVICES) {
    return memQueueJobs
      .filter((j) => j.queue === "dead-letter")
      .slice(start, start + limit);
  }

  const queue = getQueue("dead-letter");
  if (!queue) {
    return memQueueJobs.filter((j) => j.queue === "dead-letter").slice(start, start + limit);
  }

  const jobs = await queue.getJobs(["waiting", "delayed", "completed", "failed"], start, start + limit);
  return jobs.map((j) => ({
    id: j.id ?? "",
    name: j.name,
    data: j.data,
    opts: j.opts,
    queue: "dead-letter",
    timestamp: j.timestamp,
  }));
}

/**
 * Retry a job from the dead-letter queue back into its original queue.
 */
export async function retryDeadLetterJob(jobId: string): Promise<boolean> {
  const deadJob = memQueueJobs.find((j) => j.queue === "dead-letter" && j.id === jobId);
  if (deadJob && deadJob.data) {
    const payload = deadJob.data as { originalQueue: QueueName; originalData: unknown };
    if (payload.originalQueue) {
      await enqueueJob(payload.originalQueue, deadJob.name.replace(/^failed-/, ""), payload.originalData);
      return true;
    }
  }

  const queue = getQueue("dead-letter");
  if (queue) {
    const job = await queue.getJob(jobId);
    if (job && job.data) {
      const payload = job.data as { originalQueue: QueueName; originalData: unknown };
      if (payload.originalQueue) {
        await enqueueJob(payload.originalQueue, job.name.replace(/^failed-/, ""), payload.originalData);
        await job.remove();
        return true;
      }
    }
  }

  return false;
}

/** Clear in-memory mock queue for testing isolation */
export function clearMockQueuesForTesting(): void {
  memQueueJobs.length = 0;
}

export function getMockQueuedJobs(queueName?: QueueName): MockJob[] {
  if (queueName) {
    return memQueueJobs.filter((j) => j.queue === queueName);
  }
  return [...memQueueJobs];
}
