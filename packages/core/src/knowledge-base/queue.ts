import type {
  FileDocPlan,
  FileDocQueueEntry,
  QueueSummary,
  QueueTaskStatus,
  TopicPlan,
  TopicQueueEntry,
} from "./types.js";

export function buildFileDocQueue(plan: FileDocPlan, now: string): FileDocQueueEntry[] {
  return plan.batches.map((batch) => ({
    kind: "file-doc",
    batchIndex: batch.batchIndex,
    status: "pending",
    attempts: 0,
    workerId: null,
    leasedAt: null,
    updatedAt: now,
    lastError: null,
  }));
}

export function buildTopicQueue(
  plan: TopicPlan,
  options: { includeExtendedTopics: boolean; now: string },
): TopicQueueEntry[] {
  return plan.batches
    .filter((batch) => options.includeExtendedTopics || batch.tier === "required")
    .map((batch) => ({
      kind: "topic",
      batchIndex: batch.batchIndex,
      tier: batch.tier,
      status: "pending",
      attempts: 0,
      workerId: null,
      leasedAt: null,
      updatedAt: options.now,
      lastError: null,
    }));
}

export function leaseNextQueueEntry<T extends FileDocQueueEntry | TopicQueueEntry>(
  queue: T[],
  options: { workerId: string; now: string },
): { queue: T[]; leased: T | null } {
  const candidate =
    queue.find((entry) => entry.status === "needs_retry") ??
    queue.find((entry) => entry.status === "pending");
  if (!candidate) return { queue, leased: null };

  const leased = {
    ...candidate,
    status: "leased" as QueueTaskStatus,
    attempts: candidate.attempts + 1,
    workerId: options.workerId,
    leasedAt: options.now,
    updatedAt: options.now,
  } as T;

  return {
    queue: queue.map((entry) => (entry.batchIndex === leased.batchIndex ? leased : entry)),
    leased,
  };
}

export function markQueueEntrySucceeded<T extends FileDocQueueEntry | TopicQueueEntry>(
  queue: T[],
  options: { batchIndex: number; workerId: string; now: string },
): T[] {
  return queue.map((entry) =>
    entry.batchIndex !== options.batchIndex
      ? entry
      : {
          ...entry,
          status: "succeeded",
          workerId: options.workerId,
          updatedAt: options.now,
          lastError: null,
        }
  );
}

export function markQueueEntryNeedsRetry<T extends FileDocQueueEntry | TopicQueueEntry>(
  queue: T[],
  options: { batchIndex: number; workerId: string; now: string; reason: string },
): T[] {
  return queue.map((entry) =>
    entry.batchIndex !== options.batchIndex
      ? entry
      : {
          ...entry,
          status: entry.attempts >= 2 ? "failed_terminal" : "needs_retry",
          workerId: options.workerId,
          updatedAt: options.now,
          lastError: options.reason,
        }
  );
}

export function reclaimExpiredLeases<T extends FileDocQueueEntry | TopicQueueEntry>(
  queue: T[],
  options: { now: string; maxLeaseAgeMs: number },
): T[] {
  const nowMs = Date.parse(options.now);
  return queue.map((entry) => {
    if (entry.status !== "leased" || !entry.leasedAt) return entry;
    const age = nowMs - Date.parse(entry.leasedAt);
    if (age <= options.maxLeaseAgeMs) return entry;
    return {
      ...entry,
      status: "pending",
      workerId: null,
      leasedAt: null,
      updatedAt: options.now,
      lastError: entry.lastError ?? "lease expired during resume",
    };
  });
}

export function summarizeQueue<T extends FileDocQueueEntry | TopicQueueEntry>(queue: T[]): QueueSummary {
  return {
    pending: queue.filter((entry) => entry.status === "pending").length,
    leased: queue.filter((entry) => entry.status === "leased").length,
    succeeded: queue.filter((entry) => entry.status === "succeeded").length,
    needsRetry: queue.filter((entry) => entry.status === "needs_retry").length,
    failedTerminal: queue.filter((entry) => entry.status === "failed_terminal").length,
  };
}
