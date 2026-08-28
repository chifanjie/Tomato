import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

import {
  StrongRepoPulseV1Schema,
  StrongRepositorySnapshotV1Schema,
} from "@understand-code/contracts";
import type { WorkbenchEvidenceResultV1 } from "@understand-code/workbench-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanupTemporaryDirectories,
  createGitRepository,
} from "./helpers.js";

const fakes = vi.hoisted(() => {
  const snapshotId = `snapshot-${"a".repeat(64)}`;
  const otherSnapshotId = `snapshot-${"b".repeat(64)}`;
  const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const evidenceId = `diff-evidence:${"c".repeat(22)}`;
  const state: {
    evidenceItem: unknown;
    requestedEvidenceId: string;
    evidenceResult: WorkbenchEvidenceResultV1 | undefined;
  } = {
    evidenceItem: undefined,
    requestedEvidenceId: evidenceId,
    evidenceResult: undefined,
  };
  const sessionError = new Error("workbench-session-sentinel");
  const runtime = {
    store: {
      repositoryId: "repo-1",
      worktreeId: "worktree-1",
      readManifest: vi.fn(async () => ({
        artifacts: [
          {
            artifactType: "task_manifest",
            taskId,
            sourceSnapshotId: snapshotId,
          },
        ],
      })),
      readTaskBundle: vi.fn(async () => ({
        bundle: {
          manifest: {
            taskId,
            repositoryId: "repo-1",
            worktreeId: "worktree-1",
            latestSnapshotId: snapshotId,
          },
          evidence: [state.evidenceItem],
        },
        artifacts: [
          {
            artifactType: "evidence_ledger",
            taskId,
            repositoryId: "repo-1",
            worktreeId: "worktree-1",
            sourceSnapshotId: snapshotId,
          },
        ],
      })),
      readArtifact: vi.fn(async (artifactType: string) => ({
        artifact: { artifactType, payload: {} },
      })),
    },
    taskEngine: { getTaskBrief: vi.fn() },
    close: vi.fn(async () => undefined),
  };
  return {
    evidenceId,
    otherSnapshotId,
    runtime,
    sessionError,
    snapshotId,
    state,
    taskId,
    openProductionRuntime: vi.fn(async () => runtime),
    openRuntime: vi.fn(),
    openWorkbenchSessionV1: vi.fn(async (
      _input: unknown,
      options: {
        evidenceReader: (input: {
          taskId: string;
          evidenceId: string;
          repositoryId: string;
          worktreeId: string;
          snapshotId: string;
          headCommit: string | null;
        }) => Promise<WorkbenchEvidenceResultV1 | undefined>;
      },
    ) => {
      state.evidenceResult = await options.evidenceReader({
        taskId,
        evidenceId: state.requestedEvidenceId,
        repositoryId: "repo-1",
        worktreeId: "worktree-1",
        snapshotId,
        headCommit: "1".repeat(40),
      });
      throw sessionError;
    }),
  };
});

vi.mock("../src/runtime/context.js", () => ({
  openProductionRuntime: fakes.openProductionRuntime,
  openRuntime: fakes.openRuntime,
  readPublishedPulse: vi.fn(),
  readPublishedSnapshot: vi.fn(),
}));

vi.mock("@understand-code/workbench-runtime", () => ({
  openWorkbenchSessionV1: fakes.openWorkbenchSessionV1,
}));

import { callImplementedTool } from "../src/handlers/tools.js";

const sourceContent = "first\nupdated\nthird\n";
const digest = (value: string): string =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
const fixedDigest = (digit: string): string => `sha256:${digit.repeat(64)}`;

function validDiffEvidence() {
  return {
    id: fakes.evidenceId,
    profile: "evidence_backed_v1",
    kind: "diff_hunk",
    epistemicStatus: "observed",
    freshness: "current",
    claimIds: [],
    nodeIds: ["node:updated"],
    producedBy: "task-engine/strong-change-intelligence-v1",
    createdAt: "2026-08-28T00:00:00.000Z",
    observedAtSnapshotId: fakes.snapshotId,
    filePath: "src/task.ts",
    hunk: {
      id: `diff-hunk:${"d".repeat(22)}`,
      algorithm: "diff-lines-v1",
      baselineSnapshotId: fakes.otherSnapshotId,
      actualSnapshotId: fakes.snapshotId,
      path: "src/task.ts",
      beforeContent: { status: "content", contentDigest: fixedDigest("1") },
      afterContent: { status: "content", contentDigest: digest(sourceContent) },
      oldSpan: { startLine: 2, lineCount: 1 },
      newSpan: { startLine: 2, lineCount: 1 },
      sourceLayers: ["unstaged"],
      operations: [
        { op: "delete", lineDigest: fixedDigest("2") },
        { op: "insert", lineDigest: fixedDigest("3") },
      ],
      operationsDigest: fixedDigest("4"),
      patchDigest: fixedDigest("5"),
    },
  };
}

async function projectEvidence(
  evidenceItem: unknown,
): Promise<WorkbenchEvidenceResultV1> {
  const root = await createGitRepository({ seedArtifacts: false });
  await writeFile(`${root}/src/task.ts`, sourceContent, "utf8");
  fakes.state.evidenceItem = evidenceItem;
  fakes.state.requestedEvidenceId =
    evidenceItem !== null &&
    typeof evidenceItem === "object" &&
    "id" in evidenceItem &&
    typeof evidenceItem.id === "string"
      ? evidenceItem.id
      : fakes.evidenceId;
  fakes.state.evidenceResult = undefined;

  await expect(callImplementedTool(
    "open_workbench",
    { route: { view: "tasks", taskId: fakes.taskId, section: "summary" } },
    root,
    { canonicalInstallationRoot: "/provider-installation" },
  )).rejects.toBe(fakes.sessionError);

  if (fakes.state.evidenceResult === undefined) {
    throw new Error("Workbench Evidence reader did not return a projection.");
  }
  return fakes.state.evidenceResult;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(StrongRepoPulseV1Schema, "parse").mockReturnValue({
    evaluatedSnapshotId: fakes.snapshotId,
    status: "fresh",
  } as never);
  vi.spyOn(StrongRepositorySnapshotV1Schema, "parse").mockReturnValue({
    snapshotId: fakes.snapshotId,
    repositoryId: "repo-1",
    worktreeId: "worktree-1",
    repositoryStateToken: "state-token",
    headState: { kind: "commit", commit: "1".repeat(40) },
  } as never);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupTemporaryDirectories();
});

describe("Workbench diff_hunk Evidence source projection", () => {
  it("projects the authenticated after-content hunk through the source safety gates", async () => {
    const result = await projectEvidence(validDiffEvidence());

    expect(result).toMatchObject({
      status: "ready",
      evidence: {
        id: fakes.evidenceId,
        kind: "source",
        epistemicStatus: "observed",
        freshness: "current",
        nodeIds: ["node:updated"],
        filePath: "src/task.ts",
        lineRange: [2, 2],
        contentHash: digest(sourceContent),
        observedAtSnapshotId: fakes.snapshotId,
      },
      source: {
        filePath: "src/task.ts",
        lineRange: [2, 2],
        content: "updated",
        sizeBytes: 7,
        lineCount: 1,
        truncated: false,
      },
    });
  });

  it("bounds and deduplicates Graph node IDs for the Workbench Evidence contract", async () => {
    const item = validDiffEvidence();
    item.nodeIds = Array.from(
      { length: 257 },
      (_, index) => `node:${String(256 - index).padStart(3, "0")}`,
    );
    item.nodeIds.push("node:128");

    const result = await projectEvidence(item);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected ready Evidence");
    expect(result.evidence.nodeIds).toHaveLength(256);
    expect(result.evidence.nodeIds).toEqual(
      Array.from(new Set(item.nodeIds))
        .sort((left, right) => left.localeCompare(right, "en"))
        .slice(0, 256),
    );
  });

  it("passes a 257-node hunk through the real Workbench Evidence parser", async () => {
    const actualWorkbench = await vi.importActual<
      typeof import("@understand-code/workbench-runtime")
    >("@understand-code/workbench-runtime");
    const item = validDiffEvidence();
    item.nodeIds = Array.from(
      { length: 257 },
      (_, index) => `node:${String(index).padStart(3, "0")}`,
    );
    const root = await createGitRepository({ seedArtifacts: false });
    await writeFile(`${root}/src/task.ts`, sourceContent, "utf8");
    fakes.state.evidenceItem = item;
    fakes.state.requestedEvidenceId = item.id;
    fakes.openWorkbenchSessionV1.mockImplementationOnce(
      actualWorkbench.openWorkbenchSessionV1 as never,
    );

    try {
      const output = await callImplementedTool(
        "open_workbench",
        { route: { view: "tasks", taskId: fakes.taskId, section: "summary" } },
        root,
        { canonicalInstallationRoot: "/provider-installation" },
      ) as {
        structuredContent: { result: { deepLink: string } };
      };
      const launchUrl = new URL(output.structuredContent.result.deepLink);
      const token = launchUrl.hash.slice(1);
      const launch = await fetch(`${launchUrl.origin}/__workbench/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      expect(launch.status).toBe(200);
      const cookie = launch.headers.get("set-cookie")?.split(";", 1)[0];
      expect(cookie).toBeTruthy();
      const evidenceUrl = new URL("/__workbench/evidence", launchUrl.origin);
      evidenceUrl.searchParams.set("taskId", fakes.taskId);
      evidenceUrl.searchParams.set("evidenceId", item.id);
      const response = await fetch(evidenceUrl, {
        headers: { cookie: cookie! },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        status: "ready",
        evidence: {
          id: item.id,
          nodeIds: item.nodeIds.slice(0, 256),
        },
        source: { content: "updated" },
      });
    } finally {
      await actualWorkbench.closeAllWorkbenchSessionsV1();
    }
  });

  it.each([
    {
      name: "observed snapshot",
      mutate: (item: ReturnType<typeof validDiffEvidence>) => {
        item.observedAtSnapshotId = fakes.otherSnapshotId;
      },
      expected: { status: "stale", reason: "evidence_stale" },
      expectedObservedSnapshotId: fakes.otherSnapshotId,
    },
    {
      name: "actual snapshot",
      mutate: (item: ReturnType<typeof validDiffEvidence>) => {
        item.hunk.actualSnapshotId = fakes.otherSnapshotId;
      },
      expected: { status: "stale", reason: "evidence_stale" },
      expectedObservedSnapshotId: undefined,
    },
    {
      name: "file path",
      mutate: (item: ReturnType<typeof validDiffEvidence>) => {
        item.hunk.path = "src/other.ts";
      },
      expected: { status: "invalid", reason: "source_unanchored" },
    },
    {
      name: "after-content digest",
      mutate: (item: ReturnType<typeof validDiffEvidence>) => {
        item.hunk.afterContent.contentDigest = fixedDigest("9");
      },
      expected: { status: "invalid", reason: "content_changed" },
    },
  ])("fails closed when the $name is tampered", async ({
    mutate,
    expected,
    expectedObservedSnapshotId,
  }) => {
    const item = validDiffEvidence();
    mutate(item);

    const result = await projectEvidence(item);

    expect(result).toMatchObject(expected);
    if (expectedObservedSnapshotId === undefined) {
      expect(result).not.toHaveProperty("observedSnapshotId");
    } else {
      expect(result).toHaveProperty(
        "observedSnapshotId",
        expectedObservedSnapshotId,
      );
    }
    expect(result).not.toHaveProperty("source");
  });

  it.each([
    {
      name: "analysis boundary",
      item: {
        id: `boundary-evidence:${"e".repeat(22)}`,
        profile: "evidence_backed_v1",
        kind: "analysis_boundary",
        epistemicStatus: "unknown",
        freshness: "current",
        claimIds: [],
        nodeIds: [],
        producedBy: "task-engine/strong-change-intelligence-v1",
        createdAt: "2026-08-28T00:00:00.000Z",
        observedAtSnapshotId: fakes.snapshotId,
        boundary: {
          id: `analysis-boundary:${"f".repeat(22)}`,
          stage: "diff",
          code: "binary_content",
          scope: { kind: "path", path: "src/task.ts" },
          recovery: "manual_inspection",
        },
      },
      expectedReason: "source_unanchored",
    },
    {
      name: "deleted hunk",
      item: (() => {
        const item = validDiffEvidence();
        item.hunk.afterContent = { status: "absent" } as never;
        item.hunk.newSpan = { startLine: 0, lineCount: 0 };
        item.hunk.operations = [
          { op: "delete", lineDigest: fixedDigest("2") },
        ];
        return item;
      })(),
      expectedReason: "source_unanchored",
    },
    {
      name: "schema-invalid hunk",
      item: { ...validDiffEvidence(), nodeIds: "node:updated" },
      expectedReason: "evidence_invalid",
    },
    {
      name: "overflowing inclusive range",
      item: (() => {
        const item = validDiffEvidence();
        item.hunk.beforeContent = { status: "absent" } as never;
        item.hunk.oldSpan = { startLine: 0, lineCount: 0 };
        item.hunk.newSpan = {
          startLine: Number.MAX_SAFE_INTEGER,
          lineCount: 2,
        };
        item.hunk.operations = [
          { op: "insert", lineDigest: fixedDigest("2") },
          { op: "insert", lineDigest: fixedDigest("3") },
        ];
        return item;
      })(),
      expectedReason: "source_unanchored",
    },
  ])("does not expose source bytes for $name Evidence", async ({ item, expectedReason }) => {
    const result = await projectEvidence(item);

    expect(result).toMatchObject({ status: "invalid", reason: expectedReason });
    expect(result).not.toHaveProperty("source");
  });
});
