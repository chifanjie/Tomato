# High-Quality Understand-KB Writer Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-batch writer fan-out with a fixed-size, resume-aware writer pool that produces high-quality file documents and required topics without letting default runs drift into day-scale execution.

**Architecture:** Keep the existing graph/profile/file-doc/topic planning pipeline, but add explicit queue artifacts, required-vs-extended topic tiers, and stage gates. Move `/understand-kb` orchestration from “spawn one writer per batch” to “lease batches to at most two active workers,” then gate topic generation and finalization on queue state instead of optimistic retries alone.

**Tech Stack:** TypeScript ESM, Node.js fs/path JSON IO, Vitest, existing `packages/core/src/knowledge-base` planner/merge/rendering pipeline, `skills/understand-kb/generate-knowledge-base.mjs`, `skills/understand-kb/SKILL.md`, writer prompt Markdown files.

---

## File Structure

- Modify `packages/core/src/knowledge-base/types.ts`
  - Add queue entry/status types, topic tiers, queue summaries, and stricter retry metadata.
- Create `packages/core/src/knowledge-base/queue.ts`
  - Build file/topic queues, lease entries, reclaim expired leases, and mark entries succeeded/retry/terminal.
- Modify `packages/core/src/knowledge-base/planner.ts`
  - Classify topics into `required` and `extended`, and preserve tier info on each topic and batch.
- Modify `packages/core/src/knowledge-base/markdown.ts`
  - Report required-vs-extended topic coverage and queue-derived terminal failures in `覆盖报告.md`.
- Modify `packages/core/src/knowledge-base/generate.ts`
  - Thread topic tiers and queue-aware coverage inputs through deterministic generation.
- Modify `packages/core/src/knowledge-base/index.ts`
  - Export queue helpers and any new constants/types.
- Create `packages/core/src/knowledge-base/__tests__/queue.test.ts`
  - Cover queue creation, leasing, retry escalation, expired lease reclaim, and resume behavior.
- Modify `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`
  - Assert `required` vs `extended` topic planning and required-topic coverage semantics.
- Modify `packages/core/src/knowledge-base/__tests__/merge.test.ts`
  - Assert merge output can feed terminal failure reporting and does not silently accept fallback success.
- Modify `skills/understand-kb/generate-knowledge-base.mjs`
  - Add queue-writing phases, lease/complete helper phases, `--resume`, `--include-extended-topics`, and stage gate checks.
- Modify `skills/understand-kb/SKILL.md`
  - Rewrite orchestration around a fixed worker pool with explicit queue leasing instead of “one batch, one agent.”
- Modify `agents/kb-file-writer.md`
  - Accept worker metadata, retry hints, and leased-batch constraints.
- Modify `agents/kb-topic-writer.md`
  - Accept required/extended tier context, linked file-doc summary, and retry hints.

## Task 1: Add Failing Tests For Queue Lifecycles And Topic Tiers

**Files:**
- Create: `packages/core/src/knowledge-base/__tests__/queue.test.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Add queue lifecycle tests**

Create `packages/core/src/knowledge-base/__tests__/queue.test.ts` with these fixtures and expectations:

```ts
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
```

- [ ] **Step 2: Add required-vs-extended topic assertions**

Append this test to `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`:

```ts
it("splits topic planning into required and extended tiers", () => {
  const kb = generateKnowledgeBase(sampleGraph(true), {
    sourceFiles: {
      "src/api/routes.ts": "export function HandleFeedRequest() { return BuildFeed(); }\nexport function HandleAdminFeedRequest() { return BuildFeed(); }\n",
      "src/service/feed.ts": "export function BuildFeed() { return rankCandidates([]); }\nfunction rankCandidates(items) { return items; }\n",
      "src/data/store.ts": "export class CandidateStore {}\nexport function LoadCandidates() { return []; }\n",
    },
  });

  const required = kb.topicPlan.topics.filter((topic) => topic.tier === "required");
  const extended = kb.topicPlan.topics.filter((topic) => topic.tier === "extended");

  expect(required.some((topic) => topic.topicNodeId.includes("HandleFeedRequest"))).toBe(true);
  expect(required.some((topic) => topic.topicNodeId.includes("BuildFeed"))).toBe(true);
  expect(extended.some((topic) => topic.topicNodeId.includes("rankCandidates"))).toBe(true);
  expect(kb.coverageReport.requiredTopicCoverage.total).toBe(required.length);
});
```

- [ ] **Step 3: Run focused tests to verify they fail**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-anything/core exec vitest run src/knowledge-base/__tests__/queue.test.ts src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: FAIL because queue helpers, `tier`, and `requiredTopicCoverage` do not exist yet.

- [ ] **Step 4: Commit the failing tests**

```bash
git add packages/core/src/knowledge-base/__tests__/queue.test.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
git commit -m "test: define writer pool queue behavior"
```

## Task 2: Add Queue Types And Core Queue Helpers

**Files:**
- Modify: `packages/core/src/knowledge-base/types.ts`
- Create: `packages/core/src/knowledge-base/queue.ts`
- Modify: `packages/core/src/knowledge-base/index.ts`

- [ ] **Step 1: Extend knowledge-base types with queue metadata**

Add these interfaces to `packages/core/src/knowledge-base/types.ts` near the file/topic planning types:

```ts
export type TopicTier = "required" | "extended";
export type QueueTaskStatus = "pending" | "leased" | "succeeded" | "needs_retry" | "failed_terminal";

export interface QueueEntryBase {
  batchIndex: number;
  status: QueueTaskStatus;
  attempts: number;
  workerId: string | null;
  leasedAt: string | null;
  updatedAt: string;
  lastError: string | null;
}

export interface FileDocQueueEntry extends QueueEntryBase {
  kind: "file-doc";
}

export interface TopicQueueEntry extends QueueEntryBase {
  kind: "topic";
  tier: TopicTier;
}

export interface QueueSummary {
  pending: number;
  leased: number;
  succeeded: number;
  needsRetry: number;
  failedTerminal: number;
}
```

Also extend these existing types:

```ts
export interface TopicPlanItem {
  batchIndex: number;
  topicNodeId: string;
  sourceFileNodeId: string;
  documentPath: string;
  title: string;
  reasons: string[];
  coveredNodeIds: string[];
  linkedFileDocumentPath: string;
  tier: TopicTier;
}

export interface TopicBatch {
  batchIndex: number;
  topics: TopicPlanItem[];
  reason: string;
  tier: TopicTier;
}

export interface RetryPlan {
  fileBatchIndexes: number[];
  topicBatchIndexes: number[];
  fileTerminalBatchIndexes: number[];
  topicTerminalBatchIndexes: number[];
  reasons: string[];
}
```

- [ ] **Step 2: Implement `queue.ts`**

Create `packages/core/src/knowledge-base/queue.ts` with these exports:

```ts
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
```

Continue the file with helper functions:

```ts
export function leaseNextQueueEntry<T extends FileDocQueueEntry | TopicQueueEntry>(
  queue: T[],
  options: { workerId: string; now: string },
): { queue: T[]; leased: T | null } {
  const candidate = queue.find((entry) => entry.status === "needs_retry")
    ?? queue.find((entry) => entry.status === "pending");
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
```

Close the file with:

```ts
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
```

- [ ] **Step 3: Export the new queue helpers**

Update `packages/core/src/knowledge-base/index.ts`:

```ts
export * from "./queue.js";
```

- [ ] **Step 4: Run focused queue tests**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-anything/core exec vitest run src/knowledge-base/__tests__/queue.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the queue helpers**

```bash
git add packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/queue.ts packages/core/src/knowledge-base/index.ts packages/core/src/knowledge-base/__tests__/queue.test.ts
git commit -m "feat: add knowledge base queue primitives"
```

## Task 3: Classify Topics Into Required And Extended Tiers

**Files:**
- Modify: `packages/core/src/knowledge-base/planner.ts`
- Modify: `packages/core/src/knowledge-base/markdown.ts`
- Modify: `packages/core/src/knowledge-base/generate.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Add a tier classifier in `planner.ts`**

Insert this helper near `selectTopicCandidates` in `packages/core/src/knowledge-base/planner.ts`:

```ts
function topicTierForCandidate(profile: ProjectProfile, candidate: TopicCandidate): TopicTier {
  const reasons = new Set(candidate.reasons);
  if ([...reasons].some((reason) => reason.startsWith("entry candidate:"))) return "required";
  if (reasons.has("cross-layer call bridge")) return "required";
  if (reasons.has("complex business-relevant node")) return "required";

  const node = profile.indexes.nodesById.get(candidate.nodeId);
  const summary = [node?.name ?? "", node?.summary ?? "", ...(node?.tags ?? [])].join(" ").toLowerCase();
  if (/(business|feed|strategy|rule|quota|scene|experiment|表单|导流|召回|推荐|降级)/.test(summary)) {
    return "required";
  }

  return "extended";
}
```

Then update the topic-plan creation block to preserve tiers:

```ts
const candidateByNodeId = new Map(selectTopicCandidates(profile).map((candidate) => [candidate.nodeId, candidate]));

const batches: TopicBatch[] = pendingTopics
  .sort((a, b) => a.documentPath.localeCompare(b.documentPath) || a.topicNodeId.localeCompare(b.topicNodeId))
  .map((topic, index) => {
    const candidate = candidateByNodeId.get(topic.topicNodeId);
    const tier = candidate ? topicTierForCandidate(profile, candidate) : "extended";
    return {
      batchIndex: index + 1,
      topics: [{ ...topic, batchIndex: index + 1, tier }],
      reason: tier === "required" ? "required topic for default high-quality run" : "extended topic for optional continuation",
      tier,
    };
  });
```

- [ ] **Step 2: Add required/extended topic coverage in `markdown.ts`**

Extend `CoverageReport` construction so it records both the old all-topic count and required-only coverage:

```ts
const requiredTopics = topicPlan.topics.filter((topic) => topic.tier === "required");
const requiredTopicPaths = new Set(
  requiredTopics.map((topic) => topic.documentPath),
);
const generatedTopicPaths = new Set(
  documents.filter((doc) => doc.category === "topic").map((doc) => doc.path),
);

requiredTopicCoverage: {
  covered: requiredTopics.filter((topic) => generatedTopicPaths.has(topic.documentPath)).length,
  total: requiredTopics.length,
  missing: requiredTopics
    .filter((topic) => !generatedTopicPaths.has(topic.documentPath))
    .map((topic) => topic.topicNodeId),
},
extendedTopicCoverage: {
  covered: topicPlan.topics.filter((topic) => topic.tier === "extended" && generatedTopicPaths.has(topic.documentPath)).length,
  total: topicPlan.topics.filter((topic) => topic.tier === "extended").length,
  missing: topicPlan.topics
    .filter((topic) => topic.tier === "extended" && !generatedTopicPaths.has(topic.documentPath))
    .map((topic) => topic.topicNodeId),
},
```

Also print both fields in `覆盖报告.md` and set final status based on `requiredTopicCoverage`, not on `extendedTopicCoverage`.

- [ ] **Step 3: Thread the new coverage fields through deterministic generation**

In `packages/core/src/knowledge-base/generate.ts`, keep deterministic topic rendering intact, but ensure the returned `coverageReport` always includes:

```ts
requiredTopicCoverage
extendedTopicCoverage
```

Use the same `TopicPlan` instance so deterministic and phased modes share identical tier semantics.

- [ ] **Step 4: Run topic-tier tests**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-anything/core exec vitest run src/knowledge-base/__tests__/knowledge-base.test.ts
```

Expected: PASS, including the new required-vs-extended topic assertions.

- [ ] **Step 5: Commit topic tiering**

```bash
git add packages/core/src/knowledge-base/planner.ts packages/core/src/knowledge-base/markdown.ts packages/core/src/knowledge-base/generate.ts packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts
git commit -m "feat: tier knowledge base topics by delivery priority"
```

## Task 4: Track Terminal Failures Instead Of Silent Fallback Success

**Files:**
- Modify: `packages/core/src/knowledge-base/merge.ts`
- Modify: `packages/core/src/knowledge-base/types.ts`
- Modify: `packages/core/src/knowledge-base/__tests__/merge.test.ts`

- [ ] **Step 1: Add merge tests for repeated failures becoming terminal**

Append this test to `packages/core/src/knowledge-base/__tests__/merge.test.ts`:

```ts
it("surfaces retry reasons without claiming accepted fallback success", () => {
  const { profile, fileDocPlan } = fixture();
  const task = existingTask();
  const broken = fileDocument(task, {
    coveredFunctionNodeIds: [],
    markdown: markdownFor(task).replace(task.functionNodeIds[0], ""),
  });

  const result = mergeKnowledgeBaseWriterOutputs({
    profile,
    fileDocPlan: { ...fileDocPlan, tasks: [task], batches: [{ ...fileDocPlan.batches[0], tasks: [task] }] },
    fileWriterOutputs: [fileOutput(task.batchIndex, [broken])],
  });

  expect(result.validation.ok).toBe(false);
  expect(result.acceptedFileWriterDocuments).toEqual([]);
  expect(result.retryPlan.fileBatchIndexes).toEqual([task.batchIndex]);
  expect(result.retryPlan.fileTerminalBatchIndexes).toEqual([]);
});
```

- [ ] **Step 2: Extend `RetryPlan` defaults and merge output**

Update the empty retry-plan initializer in `packages/core/src/knowledge-base/merge.ts` to:

```ts
const retryPlan: RetryPlan = {
  fileBatchIndexes: [],
  topicBatchIndexes: [],
  fileTerminalBatchIndexes: [],
  topicTerminalBatchIndexes: [],
  reasons: [],
};
```

Do not mark terminal batches inside `merge.ts` yet. Keep `merge.ts` responsible for validation and retry candidates only; let the queue layer escalate to `failed_terminal` after the second failed attempt. The important change here is that all downstream code can rely on terminal-batch fields existing and empty by default.

- [ ] **Step 3: Run merge tests**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-anything/core exec vitest run src/knowledge-base/__tests__/merge.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit merge metadata changes**

```bash
git add packages/core/src/knowledge-base/merge.ts packages/core/src/knowledge-base/types.ts packages/core/src/knowledge-base/__tests__/merge.test.ts
git commit -m "feat: expose terminal failure slots for queue gating"
```

## Task 5: Add Queue-Aware CLI Phases, Resume, And Stage Gates

**Files:**
- Modify: `skills/understand-kb/generate-knowledge-base.mjs`

- [ ] **Step 1: Extend CLI argument parsing**

In `parseArgs(argv)`, add these fields and flags:

```ts
resume: false,
includeExtendedTopics: false,
workerId: "",
batchIndex: 0,
resultStatus: "",
```

Parse these flags:

```ts
else if (arg === "--resume") args.resume = true;
else if (arg === "--include-extended-topics") args.includeExtendedTopics = true;
else if (arg === "--lease-file-batch") args.phase = "lease-file-batch";
else if (arg === "--lease-topic-batch") args.phase = "lease-topic-batch";
else if (arg === "--complete-file-batch") args.phase = "complete-file-batch";
else if (arg === "--complete-topic-batch") args.phase = "complete-topic-batch";
else if (arg === "--worker-id") { args.workerId = argv[index + 1] ?? ""; index += 1; }
else if (arg === "--batch-index") { args.batchIndex = Number(argv[index + 1] ?? 0); index += 1; }
else if (arg === "--result-status") { args.resultStatus = argv[index + 1] ?? ""; index += 1; }
```

- [ ] **Step 2: Write queue artifacts during prepare phases**

In `prepareFileDocs(...)`, after writing `file-doc-batches.json`, also write:

```ts
writeJson(join(intermediateRoot, "file-doc-queue.json"), core.buildFileDocQueue(fileDocPlan, new Date().toISOString()));
```

In `prepareTopics(...)`, after `topic-plan.json` and `topic-batches.json`, also write:

```ts
writeJson(
  join(intermediateRoot, "topic-queue.json"),
  core.buildTopicQueue(topicPlan, {
    includeExtendedTopics: args.includeExtendedTopics,
    now: new Date().toISOString(),
  }),
);
```

Before `prepareTopics(...)` continues, read `file-doc-queue.json`, summarize it, and abort if any entry is not `succeeded`:

```ts
if (summary.pending || summary.leased || summary.needsRetry || summary.failedTerminal) {
  console.error("文件阶段尚未完成，不能进入专题阶段。");
  process.exit(1);
}
```

- [ ] **Step 3: Add lease phases**

Implement helpers in `generate-knowledge-base.mjs`:

```ts
function leaseBatch(core, projectRoot, queueFileName, options) {
  const { intermediateRoot } = pathsFor(projectRoot);
  const queuePath = join(intermediateRoot, queueFileName);
  const queue = existsSync(queuePath) ? readJson(queuePath) : [];
  const current = options.resume
    ? core.reclaimExpiredLeases(queue, { now: new Date().toISOString(), maxLeaseAgeMs: 30 * 60 * 1000 })
    : queue;
  const leased = core.leaseNextQueueEntry(current, {
    workerId: options.workerId,
    now: new Date().toISOString(),
  });
  writeJson(queuePath, leased.queue);
  console.log(JSON.stringify(leased.leased ?? null, null, 2));
}
```

Wire it into:

```ts
else if (args.phase === "lease-file-batch") {
  leaseBatch(core, args.projectRoot, "file-doc-queue.json", args);
} else if (args.phase === "lease-topic-batch") {
  leaseBatch(core, args.projectRoot, "topic-queue.json", args);
}
```

- [ ] **Step 4: Add completion phases**

Implement queue completion helpers:

```ts
function completeBatch(core, projectRoot, queueFileName, args) {
  const { intermediateRoot } = pathsFor(projectRoot);
  const queuePath = join(intermediateRoot, queueFileName);
  const queue = readJson(queuePath);
  const now = new Date().toISOString();

  const nextQueue = args.resultStatus === "succeeded"
    ? core.markQueueEntrySucceeded(queue, {
        batchIndex: args.batchIndex,
        workerId: args.workerId,
        now,
      })
    : core.markQueueEntryNeedsRetry(queue, {
        batchIndex: args.batchIndex,
        workerId: args.workerId,
        now,
        reason: args.resultStatus || "writer output did not pass validation",
      });

  writeJson(queuePath, nextQueue);
}
```

Wire it into:

```ts
else if (args.phase === "complete-file-batch") {
  completeBatch(core, args.projectRoot, "file-doc-queue.json", args);
} else if (args.phase === "complete-topic-batch") {
  completeBatch(core, args.projectRoot, "topic-queue.json", args);
}
```

- [ ] **Step 5: Add finalize gating**

Before `finalizeKnowledgeBase(...)` renders final docs, read `topic-queue.json` and block success if any queue entry is unresolved:

```ts
const topicQueue = existsSync(join(intermediateRoot, "topic-queue.json"))
  ? readJson(join(intermediateRoot, "topic-queue.json"))
  : [];
const queueSummary = core.summarizeQueue(topicQueue);
if (queueSummary.pending || queueSummary.leased || queueSummary.needsRetry || queueSummary.failedTerminal) {
  console.error("专题阶段尚未完成，不能进入 finalize 成功态。");
  process.exit(1);
}
```

- [ ] **Step 6: Smoke-test the new CLI phases**

Run:

```bash
cd /Users/example/understand-code
node --check skills/understand-kb/generate-knowledge-base.mjs
pnpm --filter @understand-anything/core exec vitest run src/knowledge-base/__tests__/queue.test.ts src/knowledge-base/__tests__/knowledge-base.test.ts src/knowledge-base/__tests__/merge.test.ts
```

Expected: PASS.

Then do a temp-project queue smoke test:

```bash
tmp=$(mktemp -d /tmp/ua-kb-queue.XXXXXX)
mkdir -p "$tmp/.understand-anything"
cp .understand-anything/knowledge-graph.json "$tmp/.understand-anything/knowledge-graph.json"
node skills/understand-kb/generate-knowledge-base.mjs "$tmp" --prepare-file-docs
node skills/understand-kb/generate-knowledge-base.mjs "$tmp" --lease-file-batch --worker-id file-writer-1
rm -rf "$tmp"
```

Expected: first command writes `file-doc-queue.json`; second prints one leased batch JSON object or `null` when no work remains.

- [ ] **Step 7: Commit the CLI queue phases**

```bash
git add skills/understand-kb/generate-knowledge-base.mjs
git commit -m "feat: add queue-aware understand-kb phases"
```

## Task 6: Rewrite `/understand-kb` Around A Fixed Writer Pool

**Files:**
- Modify: `skills/understand-kb/SKILL.md`
- Modify: `agents/kb-file-writer.md`
- Modify: `agents/kb-topic-writer.md`

- [ ] **Step 1: Change the skill contract from “per batch spawn” to “fixed pool lease loop”**

Replace the batch-dispatch steps in `skills/understand-kb/SKILL.md` with this flow:

```text
1. Run --prepare-file-docs.
2. Create exactly PARALLEL_LIMIT logical file workers, where PARALLEL_LIMIT defaults to 2 and must not exceed 2.
3. Each worker loops:
   - call --lease-file-batch --worker-id <id> [--resume]
   - stop if output is null
   - run kb-file-writer for the leased batch only
   - verify file-doc-batch-<batchIndex>.json exists
   - call --complete-file-batch --worker-id <id> --batch-index <n> --result-status succeeded
   - on validation or output failure call --complete-file-batch ... --result-status "<reason>"
4. After file workers stop, run --merge-file-docs.
5. Run --prepare-topics.
6. Create exactly PARALLEL_LIMIT logical topic workers and repeat the lease/complete loop with topic phases.
7. After topic workers stop, run --finalize.
8. If the user passed --include-extended-topics, repeat the topic flow for extended topics after the required-topic finalize succeeds.
```

Also update the command docs so `--parallel` only accepts `1` or `2`, and document:

```text
--resume
--include-extended-topics
```

- [ ] **Step 2: Update the file writer prompt to accept worker metadata and retry hints**

Add these required input fields to `agents/kb-file-writer.md`:

```text
- workerId
- attemptNumber
- previousFailureReason (optional)
- leasedBatchIndex
```

Add a hard rule:

```text
- Only write documents for the leased batchIndex. Do not speculate about other batches.
```

Add a retry rule:

```text
- If previousFailureReason is provided, address that gap explicitly before changing any unrelated wording.
```

- [ ] **Step 3: Update the topic writer prompt to respect required-vs-extended tiers**

Add these required input fields to `agents/kb-topic-writer.md`:

```text
- workerId
- attemptNumber
- previousFailureReason (optional)
- leasedBatchIndex
- topicTier
- linkedFileDocumentSummary
```

Add a hard rule:

```text
- For required topics, prefer complete causal explanation over brevity.
- For extended topics, preserve the same required sections but keep the prose tighter and avoid introducing new unsupported claims.
```

- [ ] **Step 4: Run prompt and skill smoke checks**

Run:

```bash
cd /Users/example/understand-code
rg -n "PARALLEL_LIMIT|lease-file-batch|complete-file-batch|include-extended-topics|resume" skills/understand-kb/SKILL.md
rg -n "workerId|attemptNumber|previousFailureReason|leasedBatchIndex|topicTier" agents/kb-file-writer.md agents/kb-topic-writer.md
```

Expected: all new fields and phases appear exactly once or more in the expected files.

- [ ] **Step 5: Commit the orchestration rewrite**

```bash
git add skills/understand-kb/SKILL.md agents/kb-file-writer.md agents/kb-topic-writer.md
git commit -m "feat: run understand-kb through a fixed writer pool"
```

## Task 7: Full Verification

**Files:**
- Test: `packages/core/src/knowledge-base/__tests__/queue.test.ts`
- Test: `packages/core/src/knowledge-base/__tests__/knowledge-base.test.ts`
- Test: `packages/core/src/knowledge-base/__tests__/merge.test.ts`
- Verify: `skills/understand-kb/generate-knowledge-base.mjs`

- [ ] **Step 1: Run focused knowledge-base tests**

```bash
cd /Users/example/understand-code
pnpm --filter @understand-anything/core exec vitest run src/knowledge-base/__tests__/queue.test.ts src/knowledge-base/__tests__/knowledge-base.test.ts src/knowledge-base/__tests__/merge.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full core test suite**

```bash
cd /Users/example/understand-code
pnpm --filter @understand-anything/core test
```

Expected: PASS.

- [ ] **Step 3: Build the core package**

```bash
cd /Users/example/understand-code
pnpm --filter @understand-anything/core build
```

Expected: PASS.

- [ ] **Step 4: Run script syntax and phase smoke checks**

```bash
cd /Users/example/understand-code
node --check skills/understand-kb/generate-knowledge-base.mjs
```

Expected: PASS.

- [ ] **Step 5: Verify queue files and required-topic gating on a temp repo**

Run a temp smoke sequence:

```bash
cd /Users/example/understand-code
tmp=$(mktemp -d /tmp/ua-kb-final.XXXXXX)
mkdir -p "$tmp/.understand-anything"
cp .understand-anything/knowledge-graph.json "$tmp/.understand-anything/knowledge-graph.json"
node skills/understand-kb/generate-knowledge-base.mjs "$tmp" --prepare-file-docs
test -f "$tmp/.understand-anything/knowledge-base/.intermediate/file-doc-queue.json"
rm -rf "$tmp"
```

Expected: the queue file exists and the command exits successfully.

- [ ] **Step 6: Commit verification-only follow-ups if needed**

```bash
git add packages/core/src/knowledge-base skills/understand-kb agents
git commit -m "test: verify high-quality knowledge base writer pool"
```

## Self-Review Checklist

- Spec coverage:
  - Fixed writer count is implemented by Task 5.
  - Queue leasing, resume, and terminal states are implemented by Tasks 2 and 5.
  - Required-vs-extended topic split is implemented by Task 3.
  - “File stage before topic stage” gate is implemented by Task 5.
  - Hour-scale mainline protection is implemented by Task 3 and Task 5 through required-topic scoping plus resume support.
- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to previous task” shortcuts remain.
- Type consistency:
  - `TopicTier`, `QueueTaskStatus`, `FileDocQueueEntry`, `TopicQueueEntry`, `requiredTopicCoverage`, and `extendedTopicCoverage` are defined once and reused by name across tasks.
