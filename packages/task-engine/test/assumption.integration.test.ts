import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ArtifactStore } from "@understand-code/artifact-store";
import {
  RepoPulseV1Schema,
  RepositorySnapshotV1Schema,
  type PersistedArtifactV1,
} from "@understand-code/contracts";
import type { KnowledgeGraph } from "@understand-code/core";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  buildContextDraft,
  TaskEngine,
  type AuthorizationContext,
  type TaskContextProvider,
} from "../src/index.js";

const REPOSITORY_ID = "repository:fixture";
const WORKTREE_ID = "worktree:fixture";
const ACTOR = "codex";
const PRODUCER_VERSION = "3.0.0-alpha.1";
const FIXED_NOW = new Date("2026-07-29T08:00:00.000Z");
const temporaryRoots: string[] = [];

function graphFixture(): KnowledgeGraph {
  return {
    version: "1",
    project: {
      name: "assumption-fixture",
      languages: ["TypeScript"],
      frameworks: [],
      description: "Stable assumption fixture",
      analyzedAt: "2026-07-29T00:00:00.000Z",
      gitCommitHash: "a".repeat(40),
    },
    nodes: [
      {
        id: "function:task",
        type: "function",
        name: "TaskHandler",
        filePath: "src/task.ts",
        lineRange: [1, 10],
        summary: "Handles a persistent Task.",
        tags: ["task"],
        complexity: "simple",
      },
    ],
    edges: [],
    layers: [],
    tour: [],
  };
}

async function loadArtifact(
  name: "repository-snapshot.json" | "repo-pulse.json",
): Promise<PersistedArtifactV1> {
  return JSON.parse(
    await readFile(
      new URL(
        `../../contracts/fixtures/v1/reference/${name}`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as PersistedArtifactV1;
}

async function repositoryContext() {
  const [snapshotArtifact, pulseArtifact] = await Promise.all([
    loadArtifact("repository-snapshot.json"),
    loadArtifact("repo-pulse.json"),
  ]);
  return {
    repositorySnapshot: RepositorySnapshotV1Schema.parse(
      snapshotArtifact.payload,
    ),
    pulse: RepoPulseV1Schema.parse(pulseArtifact.payload),
  };
}

const contextProvider: Pick<TaskContextProvider, "loadTaskContext"> = {
  async loadTaskContext(input) {
    return {
      graph: graphFixture(),
      existingFilePaths: ["src/task.ts"],
      repositorySnapshot: input.repositorySnapshot,
    };
  },
};

function authorization(
  capabilities: AuthorizationContext["capabilities"],
): AuthorizationContext {
  return {
    actor: ACTOR,
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    capabilities,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })
    ),
  );
});

describe("Task assumption Claims", () => {
  it("creates one stable honest assumption with reciprocal boundary Evidence", async () => {
    const { repositorySnapshot, pulse } = await repositoryContext();
    const input = {
      taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      intent: "Harden TaskHandler",
      snapshotId: repositorySnapshot.snapshotId,
      createdAt: "2026-07-29T08:00:00.001Z",
      pulse,
      repositorySnapshot,
      context: {
        graph: graphFixture(),
        existingFilePaths: ["src/task.ts"],
      },
    };

    const first = buildContextDraft(input);
    const second = buildContextDraft(input);

    expect(second).toEqual(first);
    expect(first.brief.assumptionClaimIds).toHaveLength(1);
    const assumptionId = first.brief.assumptionClaimIds[0]!;
    const assumption = first.claims.find(
      (claim) => claim.id === assumptionId,
    );
    expect(assumption).toMatchObject({
      kind: "assumption",
      epistemicStatus: "unknown",
      lifecycleStatus: "draft",
      statement: expect.stringContaining("Planning assumes"),
      boundaryReason: expect.stringContaining(
        "cannot prove the absence of runtime-only dependencies",
      ),
      evidenceIds: [expect.any(String)],
    });
    const boundaryEvidence = first.evidence.find(
      (item) => item.id === assumption!.evidenceIds[0],
    );
    expect(boundaryEvidence).toMatchObject({
      kind: "analysis_boundary",
      epistemicStatus: "unknown",
      claimIds: [assumptionId],
      boundaryReason: assumption!.boundaryReason,
    });
    expect(
      first.claims.every((claim) =>
        claim.evidenceIds.every((evidenceId) =>
          first.evidence.some(
            (item) =>
              item.id === evidenceId &&
              item.claimIds.includes(claim.id),
          )
        )
      ),
    ).toBe(true);
  });

  it("records the generated assumption through the normal TaskEngine mutation path", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "task-assumption-integration-"),
    );
    temporaryRoots.push(root);
    const store = await ArtifactStore.open(root, {
      repositoryId: REPOSITORY_ID,
      worktreeId: WORKTREE_ID,
      producerVersion: PRODUCER_VERSION,
    });
    await store.initialize();
    await store.persistArtifact(
      await loadArtifact("repository-snapshot.json"),
    );
    await store.persistArtifact(await loadArtifact("repo-pulse.json"));
    const engine = new TaskEngine(store, {
      contextProvider: {
        binding: {
          schemaVersion: 1,
          kind: "canonical_worktree_root",
          canonicalRoot: store.layout.worktreeRoot,
        },
        loadTaskContext(input) {
          return contextProvider.loadTaskContext(input);
        },
      },
      clock: () => FIXED_NOW,
    });
    const built = await engine.buildTaskBrief(
      {
        task: "Harden TaskHandler",
        expectedRevision: 0,
        idempotencyKey: "build-assumption-integration",
        actor: ACTOR,
      },
      authorization(["task:create"]),
    );
    const assumptionId = built.brief.assumptionClaimIds[0]!;

    const recorded = await engine.updateTask(
      {
        taskId: built.task.taskId,
        action: {
          type: "record_assumption",
          claimId: assumptionId,
        },
        expectedRevision: built.task.revision,
        idempotencyKey: "record-generated-assumption",
        actor: ACTOR,
      },
      authorization(["task:confirm"]),
    );
    const read = await store.readTaskBundle(built.task.taskId);
    if (!("brief" in read.bundle)) {
      throw new TypeError("Expected a contextual Task bundle.");
    }
    const assumption = read.bundle.claims.find(
      (claim) => claim.id === assumptionId,
    );
    const humanEvidence = read.bundle.evidence.find(
      (item) =>
        item.kind === "human" &&
        item.claimIds.includes(assumptionId),
    );
    const boundaryEvidence = read.bundle.evidence.find(
      (item) =>
        item.kind === "analysis_boundary" &&
        item.claimIds.includes(assumptionId),
    );

    expect(recorded.task).toMatchObject({
      status: "context_ready",
      revision: 3,
    });
    expect(assumption).toMatchObject({
      kind: "assumption",
      epistemicStatus: "human_confirmed",
      lifecycleStatus: "supported",
      confirmationEventId: "event:" + built.task.taskId + ":3",
      evidenceIds: expect.arrayContaining([
        boundaryEvidence!.id,
        humanEvidence!.id,
      ]),
    });
    expect(assumption).not.toHaveProperty("boundaryReason");
    expect(humanEvidence).toMatchObject({
      epistemicStatus: "human_confirmed",
      claimIds: [assumptionId],
      confirmation: {
        actor: ACTOR,
        input: assumption!.statement,
      },
    });
    expect(boundaryEvidence).toMatchObject({
      epistemicStatus: "unknown",
      claimIds: [assumptionId],
    });
  });
});
