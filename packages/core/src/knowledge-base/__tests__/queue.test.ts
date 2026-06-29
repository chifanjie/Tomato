import { describe, expect, it } from "vitest";
import type { FileDocPlan, TopicPlan } from "../index.js";
import {
  buildFileDocQueue,
  buildTopicQueue,
  leaseNextQueueEntry,
  markQueueEntryNeedsRetry,
  markQueueEntrySucceeded,
  reclaimExpiredLeases,
} from "../index.js";

function fileDocPlanFixture(): FileDocPlan {
  return {
    tasks: [],
    batches: [
      { batchIndex: 1, tasks: [], estimatedLines: 200, estimatedGraphItems: 20, reason: "batch 1" },
      { batchIndex: 2, tasks: [], estimatedLines: 300, estimatedGraphItems: 30, reason: "batch 2" },
    ],
    warnings: [],
  };
}

function topicPlanFixture(): TopicPlan {
  return {
    topics: [
      {
        batchIndex: 1,
        topicNodeId: "function:src/api/routes.ts:HandleFeedRequest",
        sourceFileNodeId: "file:src/api/routes.ts",
        documentPath: "关键函数专题/src-api-routes.ts-HandleFeedRequest.md",
        title: "HandleFeedRequest 关键函数专题",
        reasons: ["entry candidate: handler"],
        coveredNodeIds: ["function:src/api/routes.ts:HandleFeedRequest"],
        linkedFileDocumentPath: "文件文档/src-api-routes.ts.md",
        tier: "required",
      },
      {
        batchIndex: 2,
        topicNodeId: "function:src/service/feed.ts:rankCandidates",
        sourceFileNodeId: "file:src/service/feed.ts",
        documentPath: "关键函数专题/src-service-feed.ts-rankCandidates.md",
        title: "rankCandidates 关键函数专题",
        reasons: ["helper with local score"],
        coveredNodeIds: ["function:src/service/feed.ts:rankCandidates"],
        linkedFileDocumentPath: "文件文档/src-service-feed.ts.md",
        tier: "extended",
      },
    ],
    batches: [
      { batchIndex: 1, topics: [], reason: "required topic", tier: "required" },
      { batchIndex: 2, topics: [], reason: "extended topic", tier: "extended" },
    ],
    warnings: [],
  };
}

describe("knowledge-base queue", () => {
  it("creates pending queue entries for every file-doc batch", () => {
    const queue = buildFileDocQueue(fileDocPlanFixture(), "2026-06-29T00:00:00.000Z");
    expect(queue.map((entry) => [entry.batchIndex, entry.status])).toEqual([
      [1, "pending"],
      [2, "pending"],
    ]);
  });

  it("filters extended topics out of the default topic queue", () => {
    const queue = buildTopicQueue(topicPlanFixture(), {
      includeExtendedTopics: false,
      now: "2026-06-29T00:00:00.000Z",
    });
    expect(queue).toHaveLength(1);
    expect(queue[0].tier).toBe("required");
  });

  it("reuses needs_retry entries before untouched later entries", () => {
    const initial = buildFileDocQueue(fileDocPlanFixture(), "2026-06-29T00:00:00.000Z");
    const first = leaseNextQueueEntry(initial, { workerId: "file-writer-1", now: "2026-06-29T00:01:00.000Z" });
    const retryQueue = markQueueEntryNeedsRetry(first.queue, {
      batchIndex: 1,
      workerId: "file-writer-1",
      now: "2026-06-29T00:02:00.000Z",
      reason: "missing function card",
    });
    const second = leaseNextQueueEntry(retryQueue, { workerId: "file-writer-2", now: "2026-06-29T00:03:00.000Z" });
    expect(second.leased?.batchIndex).toBe(1);
    expect(second.leased?.attempts).toBe(2);
  });

  it("marks a leased file-doc queue entry as succeeded", () => {
    const initial = buildFileDocQueue(fileDocPlanFixture(), "2026-06-29T00:00:00.000Z");
    const leased = leaseNextQueueEntry(initial, { workerId: "file-writer-1", now: "2026-06-29T00:01:00.000Z" });
    const untouchedAttempts = leased.queue[1]?.attempts;
    const succeeded = markQueueEntrySucceeded(leased.queue, {
      batchIndex: 1,
      workerId: "file-writer-1",
      now: "2026-06-29T00:02:00.000Z",
    });

    expect(succeeded[0].status).toBe("succeeded");
    expect(succeeded[0].lastError).toBeNull();
    expect(succeeded[0].workerId).toBe("file-writer-1");
    expect(succeeded[1].status).toBe("pending");
    expect(succeeded[1].workerId).toBeNull();
    expect(succeeded[1].attempts).toBe(untouchedAttempts);
  });

  it("reclaims expired leases during resume", () => {
    const initial = buildFileDocQueue(fileDocPlanFixture(), "2026-06-29T00:00:00.000Z");
    const leased = leaseNextQueueEntry(initial, { workerId: "file-writer-1", now: "2026-06-29T00:01:00.000Z" }).queue;
    const reclaimed = reclaimExpiredLeases(leased, {
      now: "2026-06-29T01:30:00.000Z",
      maxLeaseAgeMs: 30 * 60 * 1000,
    });
    expect(reclaimed[0].status).toBe("pending");
    expect(reclaimed[0].workerId).toBeNull();
  });
});
